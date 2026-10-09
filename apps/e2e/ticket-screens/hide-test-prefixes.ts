import type { Page } from "@playwright/test";

import type { Fixture } from "./fixture.js";

const TEST_PREFIX = /^\[(?:Seed|Local)\]\s*/;

/**
 * Drops the `[Seed]` and `[Local]` markers from every name the API returns, so a screen shows
 * names a reader would see in production. Installed before a shot's own fixtures, so it answers
 * every request they pass on; a fixture that fetches the real response itself cleans it with
 * `clean` before answering.
 */
export class HideTestPrefixes implements Fixture {
  static clean(value: unknown): unknown {
    if (typeof value === "string") return value.replace(TEST_PREFIX, "");
    if (Array.isArray(value)) return value.map((item) => HideTestPrefixes.clean(item));
    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, HideTestPrefixes.clean(item)]),
      );
    }
    return value;
  }

  async install(page: Page): Promise<void> {
    await page.route(
      (url) => url.pathname.startsWith("/api/v1/"),
      async (route) => {
        const response = await route.fetch();
        const isJson = (response.headers()["content-type"] ?? "").includes("application/json");
        if (!isJson) {
          await route.fulfill({ response });
          return;
        }
        const body: unknown = await response.json();
        await route.fulfill({ response, json: HideTestPrefixes.clean(body) });
      },
    );
  }
}
