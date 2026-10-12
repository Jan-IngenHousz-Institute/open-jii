import type { Page } from "@playwright/test";

import { experimentId } from "../docs-media/seed-entities.js";
import type { Box } from "./change-marker.js";
import { ChangeMarker } from "./change-marker.js";
import { DROUGHT_TRIAL_TABLE } from "./fixture-tables.js";
import { FixtureWarehouse } from "./fixture-warehouse.js";
import type { Fixture, Resolvable } from "./fixture.js";
import { resolve } from "./fixture.js";

export interface TicketShot {
  /** Output basename, conventionally the ticket id and a few words. */
  readonly slug: string;
  /** Locale-less platform path, with any seeded id resolved when the shot runs. */
  readonly route: string | (() => Promise<string>);
  /** Installed before the page loads, in order; a later fixture answers first. */
  readonly fixtures?: readonly Fixture[];
  readonly viewport?: { width: number; height: number };
  /** Capture without a session. Default is the seeded development session. */
  readonly anonymous?: boolean;
  /** PostHog flags pinned on in the browser for this shot. */
  readonly featureFlags?: readonly string[];
  /**
   * Drives the page to the state the ticket describes, marks the change, and returns the crop.
   * The whole viewport is captured when it returns nothing.
   */
  readonly prepare?: (page: Page) => Promise<Box | undefined>;
}

/**
 * The example. A seeded experiment's data page, with its tables answered from the drought trial
 * fixture so the table shows rows instead of the local stack's empty warehouse. A project adds its
 * own shots to SHOTS on its scaffold branch, which is never merged.
 */
const SOYBEAN: Resolvable = () => experimentId("[Seed] Soybean Drought Response Study");

const exampleDataTable: TicketShot = {
  slug: "example-data-table",
  route: async () => `/platform/experiments/${await resolve(SOYBEAN)}/data`,
  fixtures: [new FixtureWarehouse(SOYBEAN, [DROUGHT_TRIAL_TABLE])],
  prepare: async (page) => {
    const table = page.locator("table").first();
    await page.getByText("Line A").first().waitFor();

    const marker = new ChangeMarker(page);
    await marker.mark(page.getByRole("columnheader", { name: /efficiency/i }), "Example");
    return marker.frame([table], 24);
  },
};

export const SHOTS: readonly TicketShot[] = [exampleDataTable];

export const SHOTS_BY_SLUG = new Map(SHOTS.map((shot) => [shot.slug, shot]));
