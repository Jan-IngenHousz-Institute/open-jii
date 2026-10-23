import path from "node:path";

import { expect, test } from "../fixtures.js";
import { dismissCookieBanner, locale } from "../helpers.js";

const examples = [
  "[Seed] MultispeQ Demo Example",
  "[Seed] Ambit Demo Example",
  "[Seed] MiniPAR Demo Example",
];

test("the seed owner finds all three sensor examples", async ({ page }) => {
  await page.goto(`/${locale}/platform/organizations?type=demo`);
  await dismissCookieBanner(page);
  await page.getByRole("link", { name: "openJII Demo", exact: true }).click();
  for (const name of examples) {
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  }
});

test.describe("newcomer reads the public demo seed", () => {
  test.use({ storageState: path.join(import.meta.dirname, "..", ".auth", "newcomer.json") });

  test("opens the pinned workbook and example dashboard without edit access", async ({ page }) => {
    await page.goto(`/${locale}/platform/organizations?type=demo`);
    await dismissCookieBanner(page);
    await page.getByRole("link", { name: "openJII Demo", exact: true }).click();
    for (const name of examples) {
      await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await expect(
      page.getByText(
        "You are viewing a Demo organization. Its resources are public. Viewing does not give you permission to edit them.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /request to join/i })).toHaveCount(0);
    await page.getByRole("link", { name: examples[0], exact: true }).click();
    await expect(page.getByRole("tab", { name: "Design", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Settings", exact: true })).toHaveCount(0);
    await page.getByRole("tab", { name: "Design", exact: true }).click();
    await expect(
      page
        .getByText("[Seed] Example: Demo MultispeQ placeholder protocol", { exact: true })
        .first(),
    ).toBeVisible();
    await expect(
      page.getByText("[Seed] Example: Demo MultispeQ analysis", { exact: true }).first(),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Dashboards", exact: true }).click();
    await page
      .getByRole("link", { name: "[Seed] MultispeQ Demo Example Dashboard", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "MultispeQ Example", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Synthetic placeholder content. Local charts have no lakehouse data; no real measurements are shown.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^edit$/i })).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});
