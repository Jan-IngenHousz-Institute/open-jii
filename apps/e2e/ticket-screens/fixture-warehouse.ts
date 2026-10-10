import type { Page } from "@playwright/test";

import { FixtureQuery } from "./fixture-query.js";
import type { FixtureTable } from "./fixture-tables.js";
import type { Fixture, Resolvable } from "./fixture.js";
import { resolve } from "./fixture.js";

/** Serves one experiment's data routes from fixture tables instead of the warehouse. */
export class FixtureWarehouse implements Fixture {
  private readonly query: FixtureQuery;

  constructor(
    private readonly experiment: Resolvable,
    tables: readonly FixtureTable[],
  ) {
    this.query = new FixtureQuery(tables);
  }

  async install(page: Page): Promise<void> {
    const prefix = `/api/v1/experiments/${await resolve(this.experiment)}`;

    await page.route(
      (url) => url.pathname.startsWith(`${prefix}/`),
      async (route) => {
        const url = new URL(route.request().url());
        const answer = this.query.answer(url.pathname.slice(prefix.length), url.searchParams);
        if (answer === null) {
          await route.fallback();
          return;
        }
        await route.fulfill({ status: answer.status, json: answer.body });
      },
    );
  }
}
