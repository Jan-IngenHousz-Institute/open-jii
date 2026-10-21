import { test, expect } from "@playwright/test";

const api = process.env.E2E_API_URL ?? "http://localhost:3020";
test.use({ storageState: { cookies: [], origins: [] } });

test("sign-in retry guidance and recovery", async ({ page }) => {
  test.setTimeout(120_000);
  expect(["localhost", "127.0.0.1"]).toContain(new URL(api).hostname);
  await page.goto("/en-US/login");
  const placeholder = /enter your email/i;
  const button = /continue with email/i;
  const email = `retry-${Date.now()}@example.test`;
  for (let i = 0; i < 3; i++) {
    await page.request.post(`${api}/api/v1/auth/email-otp/send-verification-otp`, {
      headers: { origin: new URL(page.url()).origin },
      data: { email: `warmup-${Date.now()}-${i}@example.test`, type: "sign-in" },
    });
  }
  await page.getByPlaceholder(placeholder).fill(email);
  const responsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/email-otp/send-verification-otp"),
  );
  await page.getByRole("button", { name: button }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(429);
  const seconds = Number(response.headers()["retry-after"]);
  expect(seconds).toBeGreaterThan(0);
  expect(seconds).toBeLessThanOrEqual(60);
  let interval = `${seconds} seconds`;
  if (seconds === 1) interval = "1 second";
  if (seconds >= 60) interval = "1 minute";
  const message = `Too many attempts. Try again in ${interval}.`;
  await expect(page.getByText(message)).toBeVisible();
  await expect(page.getByPlaceholder(placeholder)).toHaveValue(email);
  await page.waitForTimeout((seconds + 1) * 1000);
  const retryPromise = page.waitForResponse((response) =>
    response.url().endsWith("/email-otp/send-verification-otp"),
  );
  await page.getByRole("button", { name: button }).click();
  expect((await retryPromise).status()).toBe(200);
  await expect(page.getByText(/check your email/i).first()).toBeVisible();
});

test("recipient quota gives retry guidance in minutes", async ({ page }) => {
  test.setTimeout(240_000);
  expect(["localhost", "127.0.0.1"]).toContain(new URL(api).hostname);
  await page.goto("/en-US/login");
  const email = `recipient-${Date.now()}@example.test`;
  const send = () =>
    page.request.post(`${api}/api/v1/auth/email-otp/send-verification-otp`, {
      headers: { origin: new URL(page.url()).origin },
      data: { email, type: "sign-in" },
    });
  for (let i = 0; i < 5; i++) {
    let response = await send();
    if (response.status() === 429) {
      const wait = Number(response.headers()["retry-after"]);
      expect(wait).toBeGreaterThan(0);
      expect(wait).toBeLessThanOrEqual(60);
      await page.waitForTimeout((wait + 1) * 1000);
      response = await send();
    }
    expect(response.status()).toBe(200);
  }
  // Let the IP window expire so this attempt exercises the recipient quota.
  await page.waitForTimeout(61_000);
  await page.getByPlaceholder(/enter your email/i).fill(email);
  const responsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/email-otp/send-verification-otp"),
  );
  await page.getByRole("button", { name: /continue with email/i }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(429);
  const seconds = Number(response.headers()["retry-after"]);
  expect(seconds).toBeGreaterThan(60);
  const minutes = Math.ceil(seconds / 60);
  await expect(page.getByText(`Too many attempts. Try again in ${minutes} minutes.`)).toBeVisible();
  await expect(page.getByPlaceholder(/enter your email/i)).toHaveValue(email);
});
