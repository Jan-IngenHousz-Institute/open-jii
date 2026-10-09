import type { Page } from "@playwright/test";

import type { Fixture } from "./fixture.js";
import { HideTestPrefixes } from "./hide-test-prefixes.js";

/** Fetches the real response and rewrites it, to shape local data into the state a shot needs. */
export class FixtureTransform implements Fixture {
  constructor(
    private readonly matches: (url: URL) => boolean,
    private readonly transform: (url: URL, body: unknown) => unknown,
  ) {}

  async install(page: Page): Promise<void> {
    await page.route(
      (url) => this.matches(url),
      async (route) => {
        const response = await route.fetch();
        const body = HideTestPrefixes.clean(await response.json());
        const url = new URL(route.request().url());
        await route.fulfill({ response, json: this.transform(url, body) });
      },
    );
  }
}
