import type { Page } from "@playwright/test";

import { expect, test } from "../fixtures.js";
import { dismissCookieBanner, locale } from "../helpers.js";

test.setTimeout(60_000);

const traces = new WeakMap<Page, { event: string; url: string; at: number }[]>();
test.beforeEach(({ page }) => {
  const entries: { event: string; url: string; at: number }[] = [];
  traces.set(page, entries);
  page.on("request", (request) => {
    if (request.headers().rsc)
      entries.push({ event: "rsc-request", url: request.url(), at: Date.now() });
  });
  page.on("response", (response) => {
    if (response.request().headers().rsc)
      entries.push({ event: "rsc-response", url: response.url(), at: Date.now() });
  });
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame())
      entries.push({ event: "url", url: frame.url(), at: Date.now() });
  });
});
test.afterEach(async ({ page }, info) => {
  await info.attach("navigation-ordering", {
    body: JSON.stringify(traces.get(page), null, 2),
    contentType: "application/json",
  });
});

const listPath = `/${locale}/platform/experiments`;
const rowName = "[Seed] Winter Wheat Phenotyping";

async function openList(page: Page, suffix = "") {
  await page.goto(`${listPath}${suffix}`);
  await dismissCookieBanner(page);
  await expect(page.getByRole("link", { name: rowName }).first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  return page.getByRole("textbox", { name: /search/i });
}

async function freeze(page: Page) {
  const start = new Date();
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1_000));
}

test("typing then following a row before 300 ms preserves the source entry", async ({ page }) => {
  const search = await openList(page);
  const row = page.getByRole("link", { name: rowName }).first();
  const destination = await row.getAttribute("href");
  const historyLength = await page.evaluate(() => history.length);
  await freeze(page);
  await search.fill("Winter Wheat");
  expect(new URL(page.url()).searchParams.has("q")).toBe(false);
  await row.click({ force: true });
  await page.clock.runFor(400);
  await page.clock.resume();
  await expect(page).toHaveURL(
    (url) => url.pathname === destination && !url.searchParams.has("q"),
    { timeout: 20_000 },
  );
  await page.goBack();
  await expect(page).toHaveURL(
    (url) => url.pathname === listPath && url.searchParams.get("q") === "Winter Wheat",
  );
  await expect(search).toHaveValue("Winter Wheat");
  await expect(page.getByRole("link", { name: rowName }).first()).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(historyLength + 1);
  await page.goForward();
  await expect(page).toHaveURL(
    (url) => url.pathname === destination && !url.searchParams.has("q"),
    { timeout: 20_000 },
  );
});

test("a delayed router replacement cannot undo a newer departure flush", async ({ page }) => {
  const search = await openList(page);
  const row = page.getByRole("link", { name: rowName }).first();
  const destination = await row.getAttribute("href");
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let markBlocked: () => void = () => undefined;
  const blocked = new Promise<void>((resolve) => {
    markBlocked = resolve;
  });
  await page.route(
    (url) => url.pathname === listPath && url.searchParams.get("q") === "Winter",
    async (route) => {
      if (!route.request().headers().rsc) return route.continue();
      const response = await route.fetch();
      markBlocked();
      await held;
      await route.fulfill({ response });
    },
  );
  await freeze(page);
  await search.fill("Winter");
  await page.clock.runFor(300);
  await blocked;
  await search.fill("Winter Wheat");
  const navigating = page.waitForRequest(
    (request) => new URL(request.url()).pathname === destination && !!request.headers().rsc,
  );
  await row.click({ force: true });
  await page.clock.runFor(400);
  await page.clock.resume();
  await navigating;
  release();
  await expect(page).toHaveURL(
    (url) => url.pathname === destination && !url.searchParams.has("q"),
    { timeout: 20_000 },
  );
  await page.goBack();
  await expect(page).toHaveURL(
    (url) => url.pathname === listPath && url.searchParams.get("q") === "Winter Wheat",
  );
  await expect(search).toHaveValue("Winter Wheat");
});

// Reload inside the 300 ms URL debounce may lose the draft. Chromium selects the
// reload target before beforeunload; changing history during that event is too late.
test("reloading after the search commits restores the entire term", async ({ page }) => {
  const search = await openList(page);
  await freeze(page);
  await search.fill("Winter Wheat");
  expect(new URL(page.url()).searchParams.has("q")).toBe(false);
  await page.clock.runFor(300);
  await expect(page).toHaveURL((url) => url.searchParams.get("q") === "Winter Wheat");
  await page.reload();
  await page.clock.resume();
  await expect(page).toHaveURL((url) => url.searchParams.get("q") === "Winter Wheat");
  await expect(search).toHaveValue("Winter Wheat");
  await expect(page.getByRole("link", { name: rowName }).first()).toBeVisible();
});

test("Back cancels a draft and Forward restores the last committed term", async ({ page }) => {
  await page.goto(`/${locale}/platform`);
  await dismissCookieBanner(page);
  await page.getByRole("link", { name: "Experiments", exact: true }).first().click();
  const search = page.getByRole("textbox", { name: /search/i });
  await expect(search).toBeVisible();
  await page.waitForLoadState("networkidle");
  await search.fill("Winter");
  await expect(page).toHaveURL((url) => url.searchParams.get("q") === "Winter");
  await freeze(page);
  await search.fill("Winter Wheat");
  await page.goBack();
  await page.clock.runFor(400);
  await page.clock.resume();
  await expect(page).toHaveURL((url) => url.pathname === `/${locale}/platform` && !url.search);
  await page.goForward();
  await expect(page).toHaveURL(
    (url) => url.pathname === listPath && url.searchParams.get("q") === "Winter",
  );
  await expect(search).toHaveValue("Winter");
});

test("sort flushes pending search and preserves unowned params and hash", async ({ page }) => {
  const search = await openList(page, "?focus=search#list");
  const historyLength = await page.evaluate(() => history.length);
  const scrollY = await page.evaluate(() => window.scrollY);
  await freeze(page);
  const term = " Wheat + & , 植物 ";
  await search.fill(term);
  await page.getByRole("button", { name: /^Name:/i }).click({ force: true });
  await page.clock.resume();
  await expect(page).toHaveURL(
    (url) => url.searchParams.get("q") === term && !!url.searchParams.get("sort"),
  );
  expect(new URL(page.url()).searchParams.get("focus")).toBe("search");
  expect(new URL(page.url()).hash).toBe("#list");
  await search.fill("");
  await expect(page).toHaveURL(
    (url) => !url.searchParams.has("q") && !!url.searchParams.get("sort"),
  );
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
});

for (const exit of ["row", "sidebar", "header", "shortcut", "palette"] as const) {
  test(`${exit} navigation flushes the draft before leaving`, async ({ page }) => {
    const search = await openList(page);
    const row = page.getByRole("link", { name: rowName }).first();
    const destination =
      exit === "row"
        ? await row.getAttribute("href")
        : `${listPath.replace(/experiments$/, exit === "header" ? "experiments-archive" : "workbooks")}`;
    await freeze(page);
    await search.fill("Winter Wheat");
    if (exit === "row") {
      await page
        .getByRole("row")
        .filter({ has: row })
        .getByRole("cell")
        .nth(1)
        .click({ force: true });
    } else if (exit === "sidebar") {
      await page
        .getByRole("link", { name: "Workbooks", exact: true })
        .first()
        .click({ force: true });
    } else if (exit === "header") {
      await page
        .locator("header")
        .getByRole("link", { name: /archiv/i })
        .click({ force: true });
    } else if (exit === "shortcut") {
      await search.blur();
      await page.keyboard.press("g");
      await page.keyboard.press("w");
    } else {
      await page.getByRole("button", { name: "Open command palette" }).click({ force: true });
      await page.getByRole("option", { name: /^Workbooks/ }).click({ force: true });
    }
    await page.clock.runFor(400);
    await page.clock.resume();
    await expect(page).toHaveURL(
      (url) => url.pathname === destination && !url.searchParams.has("q"),
      { timeout: 20_000 },
    );
    await page.goBack();
    await expect(page).toHaveURL(
      (url) => url.pathname === listPath && url.searchParams.get("q") === "Winter Wheat",
    );
    await expect(search).toHaveValue("Winter Wheat");
  });
}

for (const exit of ["header", "sidebar"] as const) {
  test(`a same-list ${exit} navigation keeps the flushed source and resets the destination`, async ({
    page,
  }) => {
    const search = await openList(page);
    await freeze(page);
    await search.fill("Winter Wheat");
    const link =
      exit === "header"
        ? page.locator("header").getByRole("link", { name: "Experiments", exact: true })
        : page
            .locator('a[href="' + listPath + '"]')
            .filter({ hasText: "Experiments" })
            .first();
    await link.click({ force: true });
    await page.clock.runFor(400);
    await page.clock.resume();
    await expect(page).toHaveURL((url) => url.pathname === listPath && !url.searchParams.has("q"));
    await expect(search).toHaveValue("");
    await page.goBack();
    await expect(page).toHaveURL(
      (url) => url.pathname === listPath && url.searchParams.get("q") === "Winter Wheat",
    );
    await expect(search).toHaveValue("Winter Wheat");
  });
}
