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
  const message = `Too many attempts. Try again in ${seconds} seconds.`;
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
