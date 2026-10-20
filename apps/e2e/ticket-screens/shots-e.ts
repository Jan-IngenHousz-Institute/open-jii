import type { Locator, Page } from "@playwright/test";

import { experimentId } from "../docs-media/seed-entities.js";
import { ChangeMarker } from "./change-marker.js";
import { exampleLayoutFixture, examplePlots } from "./example-field.js";
import type { Fixture, Resolvable } from "./fixture.js";
import { resolve } from "./fixture.js";
import type { TicketShot } from "./shots.js";

const DROUGHT_TRIAL: Resolvable = () => experimentId("Drought trial (example data)");

export async function layoutTabRoute(view: string): Promise<string> {
  return `/platform/experiments/${await resolve(DROUGHT_TRIAL)}/layout?sessions=${view}`;
}

/** Answers one experiment-scoped API path, such as `walking-order`, for whichever experiment asks. */
export class ExperimentPathFixture implements Fixture {
  constructor(
    private readonly suffix: string,
    private readonly body: unknown,
  ) {}

  async install(page: Page): Promise<void> {
    const pattern = new RegExp(`^/api/v1/experiments/[^/]+/${this.suffix}$`);
    await page.route(
      (url) => pattern.test(url.pathname),
      (route) => route.fulfill({ status: 200, json: this.body }),
    );
  }
}

const PLOTS = examplePlots();

export function unitId(identifier: string): string {
  const plot = PLOTS.find((candidate) => candidate.identifier === identifier);
  if (!plot) throw new Error(`No plot ${identifier} in the example field`);
  return plot.id;
}

function unitIds(identifiers: readonly string[]): string[] {
  return identifiers.map(unitId);
}

/**
 * The treatment-balanced walk over the example field: every run of 12 holds each treatment
 * 4 times, give or take one, with A4 tenth, C4 twelfth and B6 thirteenth.
 */
// prettier-ignore
export const WALK = [
  "F8", "E8", "D8", "C8", "B7", "C7", "C6", "C5", "B5", "A4", "A5", "C4", "B6", "D2", "D3", "C3",
  "D6", "D7", "E6", "F7", "F6", "F5", "E5", "D5", "D4", "E4", "F4", "F3", "E3", "E2", "F2", "F1",
  "E1", "D1", "C1", "C2", "B1", "A1", "B2", "A2", "A3", "B3", "A6", "A7", "A8", "B8",
] as const;

const PLOT_ATTRIBUTES = PLOTS.map(({ id, treatment, genotype, block }) => ({
  unitId: id,
  treatment,
  genotype,
  block,
}));

/** No strategy saved yet, so the card falls back to treatment-balanced because plots carry treatments. */
export const unsavedWalkingOrder = new ExperimentPathFixture("walking-order", {
  strategy: null,
  seed: null,
  order: [],
  plots: PLOT_ATTRIBUTES,
});

export const savedWalkingOrder = new ExperimentPathFixture("walking-order", {
  strategy: "treatmentBalanced",
  seed: "field-7Q2",
  order: unitIds(WALK),
  plots: PLOT_ATTRIBUTES,
});

function card(page: Page, title: string): Locator {
  return page
    .getByText(title, { exact: true })
    .first()
    .locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
}

const strategyPicker: TicketShot = {
  slug: "e4-strategy-picker",
  route: () => layoutTabRoute("walking-order"),
  fixtures: [exampleLayoutFixture, unsavedWalkingOrder],
  viewport: { width: 1440, height: 2000 },
  prepare: async (page) => {
    await page.getByText("Walking order", { exact: true }).waitFor();
    const walkingOrder = card(page, "Walking order");
    const section = walkingOrder.locator("xpath=..");
    await section.scrollIntoViewIfNeeded();

    const marker = new ChangeMarker(page);
    await marker.mark(walkingOrder, "New", "below");
    return marker.frame([section], 16);
  },
};

/** The grid card this section draws, below the layout panel's own. */
function sessionGrid(page: Page): Locator {
  return page
    .getByText("Plot grid", { exact: true })
    .last()
    .locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
}

const orderPreview: TicketShot = {
  slug: "e5-order-preview",
  route: () => layoutTabRoute("order-preview"),
  fixtures: [exampleLayoutFixture, savedWalkingOrder],
  viewport: { width: 1440, height: 2000 },
  prepare: async (page) => {
    await page.getByText("Seed: field-7Q2").waitFor();
    const walkingOrder = card(page, "Walking order");
    const section = walkingOrder.locator("xpath=..");
    const grid = sessionGrid(page);
    await section.scrollIntoViewIfNeeded();

    const marker = new ChangeMarker(page);
    await marker.mark(grid, "New", "below");
    return marker.frame([section], 16);
  },
};

export const SEED_USER = { userId: "00000000-0000-4000-8000-0000000000a1", name: "Seed User" };
export const ALEX = { userId: "00000000-0000-4000-8000-0000000000a2", name: "Alex Example" };

export const measurers = new ExperimentPathFixture("measurers", [SEED_USER, ALEX]);

/** Equal shares cut from the walk: positions 1 to 23 and 24 to 46. */
export const SEED_USER_SHARE = WALK.slice(0, 23);
export const ALEX_SHARE = WALK.slice(23);

export const equalShares = new ExperimentPathFixture("assignments", {
  split: "equalShares",
  seed: "split-4K8",
  shares: [
    { userId: SEED_USER.userId, unitIds: unitIds(SEED_USER_SHARE) },
    { userId: ALEX.userId, unitIds: unitIds(ALEX_SHARE) },
  ],
});

const divideField: TicketShot = {
  slug: "e6-divide-field",
  route: () => layoutTabRoute("divide"),
  fixtures: [exampleLayoutFixture, savedWalkingOrder, measurers, equalShares],
  viewport: { width: 1440, height: 2000 },
  prepare: async (page) => {
    await page.getByText("Divide the field", { exact: true }).waitFor();
    const panel = card(page, "Divide the field");
    const section = panel.locator("xpath=..");
    await section.scrollIntoViewIfNeeded();

    const marker = new ChangeMarker(page);
    await marker.mark(section, "New", "below");
    return marker.frame([section], 16);
  },
};

const DROUGHT_PLOTS = PLOTS.filter((plot) => plot.treatment === "Drought").map(
  (plot) => plot.identifier,
);
const STROKE = ["F1", "F4", "F7"];

/** Alex already painted every Drought plot but the three the shot drags across in row F. */
const nearlyOneTreatment = new ExperimentPathFixture("assignments", {
  split: "equalShares",
  seed: "split-4K8",
  shares: [
    {
      userId: SEED_USER.userId,
      unitIds: unitIds(
        WALK.filter((plot) => !DROUGHT_PLOTS.includes(plot) || STROKE.includes(plot)),
      ),
    },
    {
      userId: ALEX.userId,
      unitIds: unitIds(DROUGHT_PLOTS.filter((plot) => !STROKE.includes(plot))),
    },
  ],
});

async function centerOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("The plot is not on the page");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const paintShare: TicketShot = {
  slug: "e7-paint-share",
  route: () => layoutTabRoute("divide"),
  fixtures: [exampleLayoutFixture, savedWalkingOrder, measurers, nearlyOneTreatment],
  viewport: { width: 1440, height: 2000 },
  prepare: async (page) => {
    await page.getByText("Divide the field", { exact: true }).waitFor();
    const panel = card(page, "Divide the field");
    const section = panel.locator("xpath=..");
    await section.scrollIntoViewIfNeeded();

    await page.getByRole("switch", { name: "Paint by hand" }).click();
    await page.getByRole("radio", { name: "Alex Example" }).click();

    // The pointer stays down on the last plot, so the capture holds the drag mid-stroke.
    const plots = STROKE.map((identifier) => section.locator(`[title="${identifier}"]`));
    const [first, ...rest] = await Promise.all(plots.map(centerOf));
    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    for (const point of rest) await page.mouse.move(point.x, point.y);

    const alexCard = page
      .locator("div.rounded-lg.border")
      .filter({ hasText: "A share of one treatment" });
    await alexCard.waitFor();

    const marker = new ChangeMarker(page);
    await marker.mark(alexCard, "New", "outside-left");
    for (const plot of plots) await marker.mark(plot, "New", "below");
    return marker.frame([section], 16);
  },
};

/** Today at a wall-clock time, as the browser on this machine will show it. */
export function todayAt(hours: number, minutes: number): string {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

/**
 * Mid-session, as the phone shows it: Seed User measured 10 plots, skipped A4 at 10 and stands at
 * C4, 12th. Alex walked 11 plots.
 */
const liveProgress = new ExperimentPathFixture("sessions/progress", {
  updatedAt: todayAt(10, 44),
  measurers: [
    {
      userId: SEED_USER.userId,
      measuredUnitIds: unitIds([...WALK.slice(0, 9), WALK[10]]),
      skippedUnitIds: unitIds(["A4"]),
      lastUploadAt: todayAt(10, 42),
    },
    {
      userId: ALEX.userId,
      measuredUnitIds: unitIds(WALK.slice(23, 34)),
      skippedUnitIds: [],
      lastUploadAt: todayAt(10, 15),
    },
  ],
});

const liveMonitor: TicketShot = {
  slug: "e9-live-monitor",
  route: () => layoutTabRoute("live"),
  fixtures: [exampleLayoutFixture, savedWalkingOrder, measurers, equalShares, liveProgress],
  viewport: { width: 1440, height: 2000 },
  prepare: async (page) => {
    await page.getByText("Live progress", { exact: true }).waitFor();
    const live = card(page, "Live progress");
    const section = live.locator("xpath=..");
    await section.scrollIntoViewIfNeeded();

    const marker = new ChangeMarker(page);
    await marker.mark(section, "New", "below");
    return marker.frame([section], 16);
  },
};

function plannedReadings(
  share: readonly string[],
  skipped: string,
): { unitId: string; isRepeat: boolean }[] {
  return unitIds(share.filter((plot) => plot !== skipped)).map((id) => ({
    unitId: id,
    isRepeat: false,
  }));
}

/**
 * End of day: Seed User skipped A4 as flooded and repeated C4 on purpose, and Alex skipped E4 with
 * no plant and also read D6 and D7, which sit in Seed User's share.
 */
const endedSessions = new ExperimentPathFixture("sessions/ended", [
  {
    userId: SEED_USER.userId,
    phone: "Phone A",
    endedAt: todayAt(17, 40),
    lastUploadAt: todayAt(17, 48),
    isUploaded: true,
    assignedUnitIds: unitIds(SEED_USER_SHARE),
    readings: [...plannedReadings(SEED_USER_SHARE, "A4"), { unitId: unitId("C4"), isRepeat: true }],
    skips: [{ unitId: unitId("A4"), reason: "flooded" }],
  },
  {
    userId: ALEX.userId,
    phone: "Phone B",
    endedAt: todayAt(17, 25),
    lastUploadAt: todayAt(17, 31),
    isUploaded: true,
    assignedUnitIds: unitIds(ALEX_SHARE),
    readings: [
      ...plannedReadings(ALEX_SHARE, "E4"),
      { unitId: unitId("D6"), isRepeat: false },
      { unitId: unitId("D7"), isRepeat: false },
    ],
    skips: [{ unitId: unitId("E4"), reason: "plantMissing" }],
  },
]);

const sessionOverview: TicketShot = {
  slug: "e10-session-overview",
  route: () => layoutTabRoute("overview"),
  fixtures: [exampleLayoutFixture, savedWalkingOrder, measurers, endedSessions],
  viewport: { width: 1440, height: 2000 },
  prepare: async (page) => {
    await page.getByText("Sessions ended today", { exact: true }).waitFor();
    const overview = card(page, "Sessions ended today");
    await overview.scrollIntoViewIfNeeded();

    const marker = new ChangeMarker(page);
    await marker.mark(overview, "New", "below");
    return marker.frame([overview], 16);
  },
};

export const SHOTS_E: readonly TicketShot[] = [
  strategyPicker,
  orderPreview,
  divideField,
  paintShare,
  liveMonitor,
  sessionOverview,
];
