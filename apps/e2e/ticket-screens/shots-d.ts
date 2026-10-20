import { ChangeMarker } from "./change-marker.js";
import { exampleLayoutFixture } from "./example-field.js";
import {
  ALEX,
  ExperimentPathFixture,
  SEED_USER,
  layoutTabRoute,
  measurers,
  todayAt,
  unitId,
  unsavedWalkingOrder,
} from "./shots-e.js";
import type { TicketShot } from "./shots.js";

/** Two phones on an undivided field both measured C4, and nobody asked for a repeat. */
const conflictOnC4 = new ExperimentPathFixture("plot-conflicts", [
  {
    id: "00000000-0000-4000-8000-0000000000c4",
    unitId: unitId("C4"),
    readings: [
      { userId: SEED_USER.userId, phone: "Phone A", measuredAt: todayAt(9, 42) },
      { userId: ALEX.userId, phone: "Phone B", measuredAt: todayAt(10, 15) },
    ],
    resolvedAt: null,
  },
]);

const needsReview: TicketShot = {
  slug: "d9-needs-review",
  route: () => layoutTabRoute("review"),
  fixtures: [exampleLayoutFixture, unsavedWalkingOrder, measurers, conflictOnC4],
  viewport: { width: 1440, height: 2000 },
  prepare: async (page) => {
    await page.getByText("Plot C4", { exact: true }).waitFor();
    const panel = page
      .getByText("Needs review", { exact: true })
      .first()
      .locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
    const section = panel.locator("xpath=..");
    await section.scrollIntoViewIfNeeded();

    const marker = new ChangeMarker(page);
    await marker.mark(panel, "New", "below");
    return marker.frame([section], 16);
  },
};

export const SHOTS_D: readonly TicketShot[] = [needsReview];
