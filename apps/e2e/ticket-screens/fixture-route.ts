import type { Page } from "@playwright/test";

import type { Fixture } from "./fixture.js";

/** Answers one API path with a fixed body, such as a state the database cannot hold yet. */
export class FixtureRoute implements Fixture {
  constructor(
    private readonly path: string,
    private readonly body: unknown,
  ) {}

  async install(page: Page): Promise<void> {
    await page.route(
      (url) => url.pathname === this.path,
      (route) => route.fulfill({ status: 200, json: this.body }),
    );
  }
}
