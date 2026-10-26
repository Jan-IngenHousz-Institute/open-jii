import type { Locator, Page } from "@playwright/test";

import { experimentId } from "../docs-media/seed-entities.js";
import { ChangeMarker } from "./change-marker.js";
import { exampleLayoutFixture, examplePlots } from "./example-field.js";
import type { Fixture, Resolvable } from "./fixture.js";
import { resolve } from "./fixture.js";
import type { TicketShot } from "./shots.js";

const DROUGHT_TRIAL: Resolvable = () => experimentId("Drought trial (example data)");
const VIEWPORT = { width: 1440, height: 2200 };

/** The Layout tab with one scaffold state of the Walking order or Field days view. */
export async function layoutTabRoute(state: string): Promise<string> {
  return `/platform/experiments/${await resolve(DROUGHT_TRIAL)}/layout?sessions=${state}`;
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
 * The treatment-balanced walk over the example field: every run of 12 holds each treatment in
 * proportion to its plots, give or take one, with A4 tenth, C4 twelfth and B6 thirteenth.
 */
// prettier-ignore
export const WALK = [
  "F8", "E8", "D8", "C8", "B7", "C7", "C6", "C5", "B5", "A4", "A5", "C4", "B6", "D6", "D7", "C3",
  "D2", "D3", "E6", "F7", "F6", "F5", "E5", "D5", "D4", "F4", "E3", "F3", "E4", "E2", "F2", "F1",
  "E1", "D1", "C1", "C2", "A3", "A1", "B2", "A2", "B1", "B3", "A6", "A7", "A8", "B8",
] as const;

const PLOT_ATTRIBUTES = PLOTS.map(({ id, treatment, genotype, block }) => ({
  unitId: id,
  treatment,
  genotype,
  block,
}));

/** No strategy saved yet, so the phones still walk in layout order. */
export const unsavedWalkingOrder = new ExperimentPathFixture("walking-order", {
  strategy: null,
  orderCode: null,
  order: [],
  plots: PLOT_ATTRIBUTES,
});

export const savedWalkingOrder = new ExperimentPathFixture("walking-order", {
  strategy: "treatmentBalanced",
  orderCode: "field-7Q2",
  order: unitIds(WALK),
  plots: PLOT_ATTRIBUTES,
});

/**
 * The example's field day, 14 August 2026. The live screens show it mid-morning and the overview
 * once both sessions have ended, and each such shot sets the page's clock to its moment.
 */
const FIELD_DAY_MORNING = new Date("2026-08-14T11:00:00+02:00");
const FIELD_DAY_AFTERNOON = new Date("2026-08-14T13:30:00+02:00");

/** A moment the given number of minutes before another, so relative times read true. */
function minutesBefore(moment: Date, minutes: number): string {
  return new Date(moment.getTime() - minutes * 60_000).toISOString();
}

/** A local calendar day the given number of days before a moment, as YYYY-MM-DD. */
function daysBefore(moment: Date, days: number): string {
  const date = new Date(moment);
  date.setDate(date.getDate() - days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export const SEED_USER = { userId: "00000000-0000-4000-8000-0000000000a1", name: "Seed User" };
export const ALEX = { userId: "00000000-0000-4000-8000-0000000000a2", name: "Alex Example" };

export const measurers = new ExperimentPathFixture("measurers", [SEED_USER, ALEX]);
const onlyResearcher = new ExperimentPathFixture("measurers", [SEED_USER]);
const noAssignments = new ExperimentPathFixture("assignments", null);

/** Equal shares cut from the walk: positions 1 to 23 and 24 to 46. */
export const SEED_USER_SHARE = WALK.slice(0, 23);
export const ALEX_SHARE = WALK.slice(23);

export const equalShares = new ExperimentPathFixture("assignments", {
  split: "equalShares",
  shares: [
    { userId: SEED_USER.userId, unitIds: unitIds(SEED_USER_SHARE) },
    { userId: ALEX.userId, unitIds: unitIds(ALEX_SHARE) },
  ],
});

const DROUGHT_PLOTS = PLOTS.filter((plot) => plot.treatment === "Drought").map(
  (plot) => plot.identifier,
);
const STROKE = ["F1", "F4", "F7"];

/** Alex already painted every Drought plot but the three the shot drags across in row F. */
const nearlyOneTreatment = new ExperimentPathFixture("assignments", {
  split: "equalShares",
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

/**
 * Mid-session, as the phone shows it: Seed User measured 10 plots, skipped A4 at 10 and stands at
 * C4, 12th. Alex walked 11 plots and has been quiet for half an hour.
 */
const liveProgress = new ExperimentPathFixture("sessions/progress", {
  updatedAt: minutesBefore(FIELD_DAY_MORNING, 0),
  measurers: [
    {
      userId: SEED_USER.userId,
      measuredUnitIds: unitIds([...WALK.slice(0, 9), WALK[10]]),
      skippedUnitIds: unitIds(["A4"]),
      lastUploadAt: minutesBefore(FIELD_DAY_MORNING, 2),
    },
    {
      userId: ALEX.userId,
      measuredUnitIds: unitIds(WALK.slice(23, 35).filter((plot) => plot !== "E4")),
      skippedUnitIds: unitIds(["E4"]),
      lastUploadAt: minutesBefore(FIELD_DAY_MORNING, 29),
    },
  ],
});

/** The same morning before Alex's phone has sent anything. */
const liveProgressNoUpload = new ExperimentPathFixture("sessions/progress", {
  updatedAt: minutesBefore(FIELD_DAY_MORNING, 0),
  measurers: [
    {
      userId: SEED_USER.userId,
      measuredUnitIds: unitIds([...WALK.slice(0, 9), WALK[10]]),
      skippedUnitIds: unitIds(["A4"]),
      lastUploadAt: minutesBefore(FIELD_DAY_MORNING, 2),
    },
    { userId: ALEX.userId, measuredUnitIds: [], skippedUnitIds: [], lastUploadAt: null },
  ],
});

const sessionDays = new ExperimentPathFixture("sessions/days", [
  daysBefore(FIELD_DAY_AFTERNOON, 0),
  daysBefore(FIELD_DAY_AFTERNOON, 3),
  daysBefore(FIELD_DAY_AFTERNOON, 7),
]);

function plannedReadings(
  share: readonly string[],
  skipped: string,
  flagged?: string,
): { unitId: string; isRepeat: boolean; isFlagged: boolean }[] {
  const flaggedId = flagged ? unitId(flagged) : null;
  return unitIds(share.filter((plot) => plot !== skipped)).map((id) => ({
    unitId: id,
    isRepeat: false,
    isFlagged: id === flaggedId,
  }));
}

const seedUserSession = {
  userId: SEED_USER.userId,
  phone: "Phone A",
  endedAt: minutesBefore(FIELD_DAY_AFTERNOON, 85),
  lastUploadAt: minutesBefore(FIELD_DAY_AFTERNOON, 80),
  isUploaded: true,
  assignedUnitIds: unitIds(SEED_USER_SHARE),
  readings: [
    ...plannedReadings(SEED_USER_SHARE, "A4", "B6"),
    { unitId: unitId("C4"), isRepeat: true, isFlagged: false },
  ],
  skips: [{ unitId: unitId("A4"), reason: "flooded" }],
  failedUploadUnitIds: [],
};

/**
 * End of day: Seed User skipped A4 as flooded, repeated C4 on purpose and flagged the reading on B6.
 * Alex skipped E4 with no plant, also read D6 and D7, which sit in Seed User's share, and the phone
 * reported that the reading on F2 never uploaded.
 */
const endedSessions = new ExperimentPathFixture("sessions/ended", [
  seedUserSession,
  {
    userId: ALEX.userId,
    phone: "Phone B",
    endedAt: minutesBefore(FIELD_DAY_AFTERNOON, 70),
    lastUploadAt: minutesBefore(FIELD_DAY_AFTERNOON, 63),
    isUploaded: true,
    assignedUnitIds: unitIds(ALEX_SHARE),
    readings: [
      ...plannedReadings(
        ALEX_SHARE.filter((plot) => plot !== "F2"),
        "E4",
      ),
      { unitId: unitId("D6"), isRepeat: false, isFlagged: false },
      { unitId: unitId("D7"), isRepeat: false, isFlagged: false },
    ],
    skips: [{ unitId: unitId("E4"), reason: "plantMissing" }],
    failedUploadUnitIds: [unitId("F2")],
  },
]);

/** The same day while Alex's phone has uploaded only its first 11 readings since the session ended. */
const endedSessionsWaiting = new ExperimentPathFixture("sessions/ended", [
  seedUserSession,
  {
    userId: ALEX.userId,
    phone: "Phone B",
    endedAt: minutesBefore(FIELD_DAY_AFTERNOON, 70),
    lastUploadAt: minutesBefore(FIELD_DAY_AFTERNOON, 130),
    isUploaded: false,
    assignedUnitIds: unitIds(ALEX_SHARE),
    readings: plannedReadings(ALEX_SHARE.slice(0, 11), "E4"),
    skips: [],
    failedUploadUnitIds: [],
  },
]);

function reading(
  id: string,
  user: { userId: string },
  phone: string,
  at: string,
  efficiency: string,
  stressIndex: string,
) {
  return {
    readingId: id,
    userId: user.userId,
    phone,
    measuredAt: at,
    values: [
      { label: "efficiency", value: efficiency },
      { label: "stress_index", value: stressIndex },
    ],
  };
}

/** Alex's readings on D6 and D7 landed on plots Seed User had measured, with the values F shows. */
const plotsMeasuredTwice = new ExperimentPathFixture("measured-twice", [
  {
    id: "00000000-0000-4000-8000-0000000000d6",
    unitId: unitId("D6"),
    readings: [
      reading(
        "00000000-0000-4000-8000-00000000d601",
        SEED_USER,
        "Phone A",
        "2026-08-14T09:25:00.000Z",
        "0.61",
        "0.29",
      ),
      reading(
        "00000000-0000-4000-8000-00000000d602",
        ALEX,
        "Phone B",
        "2026-08-14T10:12:00.000Z",
        "0.47",
        "0.41",
      ),
    ],
    resolution: null,
  },
  {
    id: "00000000-0000-4000-8000-0000000000d7",
    unitId: unitId("D7"),
    readings: [
      reading(
        "00000000-0000-4000-8000-00000000d701",
        SEED_USER,
        "Phone A",
        "2026-08-14T09:30:00.000Z",
        "0.66",
        "0.25",
      ),
      reading(
        "00000000-0000-4000-8000-00000000d702",
        ALEX,
        "Phone B",
        "2026-08-14T10:15:00.000Z",
        "0.52",
        "0.37",
      ),
    ],
    resolution: null,
  },
]);

const noneMeasuredTwice = new ExperimentPathFixture("measured-twice", []);

// CSS rather than roles, since an open dialog hides the rest of the page from role queries.
function layoutTab(page: Page): Locator {
  return page.locator("[role=tab]", { hasText: /^Layout$/ });
}

function viewSwitch(page: Page): Locator {
  return page.locator('[role=tablist][aria-label="Layout views"]');
}

function card(locator: Locator): Locator {
  return locator.locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
}

function cardWith(page: Page, text: string): Locator {
  return card(page.getByText(text, { exact: true }).first());
}

function strategyCard(page: Page): Locator {
  return cardWith(
    page,
    "How measurers walk the field. Phones receive it when their next session starts.",
  );
}

function gridCard(page: Page): Locator {
  return cardWith(page, "Plot grid");
}

function dividePanel(page: Page): Locator {
  return cardWith(page, "Divide the field");
}

function measuredTwicePanel(page: Page): Locator {
  return page.locator("#measured-twice");
}

async function settle(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
}

const strategyPicker: TicketShot = {
  slug: "e3-strategy-picker",
  route: () => layoutTabRoute("walking-order"),
  fixtures: [exampleLayoutFixture, savedWalkingOrder],
  viewport: VIEWPORT,
  prepare: async (page) => {
    await page.getByText("Recommended", { exact: true }).waitFor();
    await settle(page);

    const marker = new ChangeMarker(page);
    await marker.mark(strategyCard(page), "New", "below");
    return marker.frame(
      [layoutTab(page), viewSwitch(page), gridCard(page), strategyCard(page)],
      24,
    );
  },
};

const layoutOrder: TicketShot = {
  slug: "e3-layout-order",
  route: () => layoutTabRoute("walking-order"),
  fixtures: [exampleLayoutFixture, unsavedWalkingOrder],
  viewport: { width: 1440, height: 1000 },
  prepare: async (page) => {
    const choose = page.getByRole("button", { name: "Choose a walking order" });
    await choose.waitFor();
    const title = page.getByText("Walked in layout order", { exact: true });
    await settle(page);

    const marker = new ChangeMarker(page);
    await marker.mark(choose, "New", "below");
    return marker.frame([layoutTab(page), viewSwitch(page), card(title)], 24);
  },
};

const orderPreview: TicketShot = {
  slug: "e4-order-preview",
  route: () => layoutTabRoute("order-preview"),
  fixtures: [exampleLayoutFixture, savedWalkingOrder],
  viewport: VIEWPORT,
  prepare: async (page) => {
    await page.getByText("field-7Q2", { exact: true }).waitFor();
    await settle(page);

    const marker = new ChangeMarker(page);
    await marker.mark(gridCard(page), "New", "below");
    return marker.frame(
      [layoutTab(page), viewSwitch(page), gridCard(page), strategyCard(page)],
      24,
    );
  },
};

/** E6 shows the panel before E7 adds painting, so its shot hides the switch. */
async function hidePainting(page: Page): Promise<void> {
  const painting = page.locator("[data-paint-by-hand]");
  await painting.waitFor();
  await painting.evaluate((element) => {
    element.setAttribute("hidden", "");
  });
}

const divideField: TicketShot = {
  slug: "e6-divide-field",
  route: () => layoutTabRoute("divide"),
  fixtures: [exampleLayoutFixture, savedWalkingOrder, measurers, equalShares],
  viewport: VIEWPORT,
  prepare: async (page) => {
    await page.getByText("Divide the field", { exact: true }).waitFor();
    await hidePainting(page);
    await settle(page);

    const marker = new ChangeMarker(page);
    await marker.mark(gridCard(page), "New", "below");
    await marker.mark(dividePanel(page), "New", "below");
    return marker.frame([layoutTab(page), viewSwitch(page), gridCard(page), dividePanel(page)], 24);
  },
};

const inviteMeasurer: TicketShot = {
  slug: "e6-invite-measurer",
  route: () => layoutTabRoute("divide"),
  fixtures: [exampleLayoutFixture, savedWalkingOrder, onlyResearcher, noAssignments],
  viewport: VIEWPORT,
  prepare: async (page) => {
    await page.getByRole("link", { name: "Invite a measurer" }).waitFor();
    await settle(page);

    const marker = new ChangeMarker(page);
    await marker.mark(dividePanel(page), "New", "below");
    return marker.frame([layoutTab(page), viewSwitch(page), dividePanel(page)], 24);
  },
};

async function centerOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("The plot is not on the page");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function plotButton(page: Page, identifier: string): Locator {
  return page.getByRole("button", { name: identifier, exact: true });
}

async function paintIntoAlex(page: Page): Promise<void> {
  await page.getByText("Divide the field", { exact: true }).waitFor();
  await page.getByRole("switch", { name: "Paint by hand" }).click();
  await page.getByRole("radio", { name: /Alex Example/ }).click();
}

const paintShare: TicketShot = {
  slug: "e7-paint-share",
  route: () => layoutTabRoute("divide"),
  fixtures: [exampleLayoutFixture, savedWalkingOrder, measurers, nearlyOneTreatment],
  viewport: VIEWPORT,
  prepare: async (page) => {
    await paintIntoAlex(page);

    // The pointer stays down on the last plot, so the capture holds the drag mid-stroke.
    const plots = STROKE.map((identifier) => plotButton(page, identifier));
    const [first, ...rest] = await Promise.all(plots.map(centerOf));
    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    for (const point of rest) await page.mouse.move(point.x, point.y);
    await page.getByText("Missing Control and Severe drought").waitFor();

    const controls = page.getByText("Paint into", { exact: true }).locator("xpath=../..");
    const shareCards = page.locator("div.rounded-lg.border").filter({ hasText: /plots?, rows/ });

    const marker = new ChangeMarker(page);
    await marker.mark(controls, "New", "outside-left");
    await marker.mark([shareCards.first(), shareCards.last()], "New", "outside-left");
    for (const plot of plots) await marker.mark(plot, "New", "below");
    return marker.frame([layoutTab(page), viewSwitch(page), gridCard(page), dividePanel(page)], 24);
  },
};

const replacePainted: TicketShot = {
  slug: "e7-replace-painted",
  route: () => layoutTabRoute("divide"),
  fixtures: [exampleLayoutFixture, savedWalkingOrder, measurers, nearlyOneTreatment],
  viewport: { width: 1440, height: 1200 },
  prepare: async (page) => {
    await paintIntoAlex(page);
    await plotButton(page, "F1").click();
    await page.getByRole("button", { name: "Regenerate" }).click();

    const dialog = page.getByRole("alertdialog");
    await dialog.waitFor();
    await settle(page);

    const marker = new ChangeMarker(page);
    await marker.mark(dialog, "New", "above");
    return marker.frame([dialog], 40);
  },
};

function liveCard(page: Page): Locator {
  return cardWith(page, "Live progress");
}

const liveMonitor: TicketShot = {
  slug: "e9-live-monitor",
  clock: FIELD_DAY_MORNING,
  route: () => layoutTabRoute("live"),
  fixtures: [exampleLayoutFixture, savedWalkingOrder, measurers, equalShares, liveProgress],
  viewport: VIEWPORT,
  prepare: async (page) => {
    await page.getByText("Live progress", { exact: true }).waitFor();
    await settle(page);

    const marker = new ChangeMarker(page);
    await marker.mark(gridCard(page), "New", "below");
    await marker.mark(liveCard(page), "New", "below");
    return marker.frame([layoutTab(page), viewSwitch(page), gridCard(page), liveCard(page)], 24);
  },
};

const noUpload: TicketShot = {
  slug: "e9-no-upload",
  clock: FIELD_DAY_MORNING,
  route: () => layoutTabRoute("live"),
  fixtures: [exampleLayoutFixture, savedWalkingOrder, measurers, equalShares, liveProgressNoUpload],
  viewport: VIEWPORT,
  prepare: async (page) => {
    const line = page.getByText("No upload yet.", { exact: true });
    await line.waitFor();
    await settle(page);

    const marker = new ChangeMarker(page);
    await marker.mark(line.locator("xpath=../.."), "New", "outside-left");
    return marker.frame([layoutTab(page), viewSwitch(page), gridCard(page), liveCard(page)], 24);
  },
};

function dayRow(page: Page): Locator {
  return page.locator("#field-day").locator("xpath=..");
}

function overviewCard(page: Page): Locator {
  return cardWith(page, "Overview of the day");
}

const sessionOverview: TicketShot = {
  slug: "e10-session-overview",
  clock: FIELD_DAY_AFTERNOON,
  route: () => layoutTabRoute("overview"),
  fixtures: [
    exampleLayoutFixture,
    savedWalkingOrder,
    measurers,
    sessionDays,
    endedSessions,
    plotsMeasuredTwice,
  ],
  viewport: VIEWPORT,
  prepare: async (page) => {
    await page.getByText("Overview of the day", { exact: true }).waitFor();
    await settle(page);

    const marker = new ChangeMarker(page);
    await marker.mark(dayRow(page), "New", "inside-right");
    await marker.mark(overviewCard(page), "New", "inside-top-right");
    await marker.mark(gridCard(page), "New", "below");
    return marker.frame(
      [
        layoutTab(page),
        viewSwitch(page),
        dayRow(page),
        overviewCard(page),
        gridCard(page),
        measuredTwicePanel(page),
      ],
      24,
    );
  },
};

const waiting: TicketShot = {
  slug: "e10-waiting",
  clock: FIELD_DAY_AFTERNOON,
  route: () => layoutTabRoute("overview"),
  fixtures: [
    exampleLayoutFixture,
    savedWalkingOrder,
    measurers,
    sessionDays,
    endedSessionsWaiting,
    noneMeasuredTwice,
  ],
  viewport: VIEWPORT,
  prepare: async (page) => {
    const badge = page.getByText("Waiting for upload", { exact: true });
    await badge.waitFor();
    await settle(page);

    const marker = new ChangeMarker(page);
    await marker.mark(page.getByText("1 phone waiting", { exact: true }), "New", "below");
    await marker.mark(badge.locator("xpath=ancestor::tr[1]"), "New", "outside-left");
    return marker.frame([layoutTab(page), viewSwitch(page), dayRow(page), overviewCard(page)], 24);
  },
};

const measuredTwice: TicketShot = {
  slug: "d9-measured-twice",
  clock: FIELD_DAY_AFTERNOON,
  route: () => layoutTabRoute("review"),
  fixtures: [exampleLayoutFixture, savedWalkingOrder, measurers, plotsMeasuredTwice],
  viewport: VIEWPORT,
  prepare: async (page) => {
    await measuredTwicePanel(page).getByText("Plot D6", { exact: true }).waitFor();
    await settle(page);

    const marker = new ChangeMarker(page);
    await marker.mark(measuredTwicePanel(page), "New", "below");
    return marker.frame(
      [layoutTab(page), viewSwitch(page), gridCard(page), measuredTwicePanel(page)],
      24,
    );
  },
};

export const SHOTS_E: readonly TicketShot[] = [
  strategyPicker,
  layoutOrder,
  orderPreview,
  divideField,
  inviteMeasurer,
  paintShare,
  replacePainted,
  liveMonitor,
  noUpload,
  sessionOverview,
  waiting,
  measuredTwice,
];
