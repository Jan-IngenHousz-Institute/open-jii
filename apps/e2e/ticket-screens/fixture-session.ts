import type { Page } from "@playwright/test";

import { zResourceCapabilities } from "@repo/api/domains/authorization/capabilities.schema";
import { zExperimentAccess } from "@repo/api/domains/experiment/experiment.schema";

import type { Fixture, Resolvable } from "./fixture.js";
import { resolve } from "./fixture.js";

/**
 * Shows an experiment as a signed-in non-member sees it: the access answer keeps the experiment
 * but grants nothing. The rest of the page still reads with the shot's own session.
 */
export class NonMemberView implements Fixture {
  constructor(private readonly experiment: Resolvable) {}

  async install(page: Page): Promise<void> {
    const accessPath = `/api/v1/experiments/${await resolve(this.experiment)}/access`;

    await page.route(
      (url) => url.pathname === accessPath,
      async (route) => {
        const response = await route.fetch();
        const access = zExperimentAccess.parse(await response.json());
        const none = Object.keys(access.capabilities).map((key) => [key, false]);

        await route.fulfill({
          response,
          json: {
            ...access,
            isAdmin: false,
            membershipStatus: "none",
            capabilities: zResourceCapabilities.parse(Object.fromEntries(none)),
          },
        });
      },
    );
  }
}
