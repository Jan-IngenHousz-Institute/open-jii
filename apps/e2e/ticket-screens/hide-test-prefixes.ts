import type { Page } from "@playwright/test";

import type { Fixture } from "./fixture.js";

const TEST_PREFIX = /^\[(?:Seed|Local)\]\s*/;

/**
 * Drops the `[Seed]` and `[Local]` markers from every name the API returns, so a screen shows
 * names a reader would see in production. Installed before a shot's own fixtures, so it only
 * sees the requests they pass on.
 */
export class HideTestPrefixes implements Fixture {
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
        await route.fulfill({ response, json: this.clean(body) });
      },
    );
  }

  private clean(value: unknown): unknown {
    if (typeof value === "string") return value.replace(TEST_PREFIX, "");
    if (Array.isArray(value)) return value.map((item) => this.clean(item));
    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, this.clean(item)]),
      );
    }
    return value;
  }
}
