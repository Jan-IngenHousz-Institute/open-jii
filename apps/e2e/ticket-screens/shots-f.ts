import type { Locator, Page } from "@playwright/test";

import { experimentId } from "../docs-media/seed-entities.js";
import { ChangeMarker } from "./change-marker.js";
import type { Fixture, Resolvable } from "./fixture.js";
import { resolve } from "./fixture.js";
import {
  EXAMPLE_DESIGN,
  miappeFields,
  noLinkedWorkbook,
  standards,
  trialTables,
} from "./shots-b.js";
import type { TicketShot } from "./shots.js";

const DROUGHT_TRIAL: Resolvable = () => experimentId("Drought trial (example data)");
const VIEWPORT = { width: 1440, height: 1000 };

// The example dataset from `.claude/drafts/example-field.md`. No dataset table exists, so every
// dataset route is answered here.
const VERSION_1_ID = "00000000-0000-4000-9000-000000000001";
const VERSION_2_ID = "00000000-0000-4000-9000-000000000002";
const DATASET_TITLE = "Drought trial, 2026 season (example data)";
const DATASET_DESCRIPTION =
  "Soybean lines under three irrigation treatments, measured weekly through the season.";
const DATASET_LIMITATIONS =
  "On 14 August 2026 plot A4 was not measured because it was flooded, and plot E4 because its plant was missing.";
const VERSION_1_DOI = "10.5281/zenodo.0000000";
const VERSION_2_DOI = "10.5281/zenodo.0000001";
// Zenodo's sandbox issues test DOIs under its own prefix.
const SANDBOX_DOI = "10.5072/zenodo.0000000";
const PUBLISHER = "Jan IngenHousz Institute";
const FUNDING = [{ funderName: "Example Research Council", awardNumber: "EX-2026-001" }];
/** An organism from NCBI Taxonomy, in the study record's subject shape. */
function organism(label: string, taxonId: string) {
  return {
    label,
    term: {
      id: `NCBITaxon:${taxonId}`,
      label,
      vocabulary: "NCBI Taxonomy",
      iri: `http://purl.obolibrary.org/obo/NCBITaxon_${taxonId}`,
    },
  };
}

const STUDY_DETAILS = {
  subjects: [organism("Glycine max", "3847")],
  startDate: "2026-05-04",
  endDate: "2026-09-25",
  experimentalDesign: EXAMPLE_DESIGN,
  growthFacility: "Open field",
};

// The experiment holds 922 readings. Version 1 leaves out the 2 flagged in Curate, and version 2,
// a correction, also leaves out the 20 readings of one plot.
const EXPERIMENT_READINGS = 922;
const VERSION_1_READINGS = 920;
const VERSION_2_READINGS = 900;
const PLOT_COUNT = 46;

// Readings are taken on Wednesdays, 46 plots a day, and the 14 August session adds the two plots
// measured twice.
const SESSION_DAY = "2026-08-14";
const FIRST_FIELD_DAY = "2026-05-13";
const LAST_FIELD_DAY = "2026-09-16";
const FIELD_DAYS = 19;

function fieldDays() {
  const weekly = Array.from({ length: FIELD_DAYS }, (_, week) => ({
    date: new Date(Date.UTC(2026, 4, 13 + week * 7)).toISOString().slice(0, 10),
    readingCount: PLOT_COUNT,
  }));
  const days = [...weekly, { date: SESSION_DAY, readingCount: PLOT_COUNT + 2 }];
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

const RAW_TABLE = { name: "raw_data", displayName: "Raw Data" };
const DAILY_MEANS_TABLE = {
  name: "00000000-0000-4000-8000-0000000000a5",
  displayName: "Daily means",
};

// The daily means are a check the team keeps for itself, so the dataset holds the readings alone.
const SCOPE_CHOICE = { tables: [RAW_TABLE], from: FIRST_FIELD_DAY, to: LAST_FIELD_DAY };

const SCOPE = {
  version: 1,
  tables: [
    { ...RAW_TABLE, readingCount: EXPERIMENT_READINGS, days: fieldDays() },
    { ...DAILY_MEANS_TABLE, readingCount: 96, days: null },
  ],
  firstReadingOn: FIRST_FIELD_DAY,
  lastReadingOn: LAST_FIELD_DAY,
  countedAt: "2026-09-30T09:00:00.000Z",
  previous: null,
};

type Request = "pending" | "accepted" | null;
type Origin = "member" | "organization" | "email";

interface Person {
  userId: string | null;
  givenName: string;
  familyName: string;
  orcid: string | null;
  affiliation: string | null;
}

const SEED_USER: Person = {
  userId: "00000000-0000-4000-a000-000000000001",
  givenName: "Seed",
  familyName: "User",
  orcid: "0000-0002-1825-0097",
  affiliation: "Example University",
};
const ALEX: Person = {
  userId: "00000000-0000-4000-a000-000000000002",
  givenName: "Alex",
  familyName: "Example",
  orcid: null,
  affiliation: "Example University",
};
const ROBIN: Person = {
  userId: "00000000-0000-4000-a000-000000000003",
  givenName: "Robin",
  familyName: "Example",
  orcid: null,
  affiliation: "Example University",
};
const JORDAN: Person = {
  userId: "00000000-0000-4000-a000-000000000004",
  givenName: "Jordan",
  familyName: "Example",
  orcid: null,
  affiliation: "Example University",
};
const KIM: Person = {
  userId: "00000000-0000-4000-a000-000000000005",
  givenName: "Kim",
  familyName: "Example",
  orcid: "0000-0001-5109-3700",
  affiliation: "Example University",
};
// Sam was invited by email and has an account once the invitation is accepted.
const SAM: Person = {
  userId: "00000000-0000-4000-a000-000000000006",
  givenName: "Sam",
  familyName: "Example",
  orcid: null,
  affiliation: null,
};
const SAM_EMAIL = "sam@example.org";

/** Everyone in the experiment, whom Describe lists as an author, a contributor or neither. */
const MEMBERS = [SEED_USER, ALEX, ROBIN, JORDAN, KIM];

function named(person: Person, origin: Origin, request: Request) {
  return { ...person, origin, email: null, request };
}

/** Seed User freezes, so only the others were asked, and everyone has accepted. */
const AUTHORS = [
  named(SEED_USER, "member", null),
  named(ALEX, "member", "accepted"),
  named(ROBIN, "member", "accepted"),
  named(SAM, "email", "accepted"),
];

/** The draft before Alex has answered and before Sam has signed up. */
const DRAFT_AUTHORS = [
  named(SEED_USER, "member", null),
  named(ALEX, "member", "pending"),
  named(ROBIN, "member", "accepted"),
  { ...SAM, userId: null, origin: "email", email: SAM_EMAIL, request: "pending" },
];

/** Jordan measured but is no author, so Jordan is a data collector. Kim is neither. */
function contributors(request: Request) {
  const { affiliation: _affiliation, ...jordan } = JORDAN;
  return [{ ...jordan, origin: "member", email: null, request, contributorType: "DataCollector" }];
}

function file(kind: string, name: string, sizeBytes: number, report: object | null = null) {
  return {
    kind,
    name,
    sizeBytes,
    sha256: "3f1c9a52e0b84d7c6a1e2f9b0d4c8a7e5b3f2a1c0d9e8f7a6b5c4d3e2f1a0b9c",
    report,
  };
}

const FILES = [
  file("snapshot", "readings.csv", 193_240),
  file("snapshot", "readings.parquet", 61_408),
  file("dataDictionary", "data-dictionary.csv", 4_812),
];

// The standard packages of a frozen dataset whose experiment follows the plant phenotyping
// checklist. Freeze waited for every required field, so none is missing.
const PACKAGE_FILES = [
  ...FILES,
  file("analysisTable", "analysis-table.csv", 241_906),
  file("analysisTable", "analysis-table.parquet", 72_115),
  file("analysisTable", "codebook.csv", 3_906),
  file("roCrate", "ro-crate-metadata.json", 9_480, {
    type: "conformsTo",
    profiles: ["RO-Crate 1.2", "MIAPPE 1.1"],
  }),
  file("miappe", "miappe-isa-tab.zip", 38_212, {
    type: "validated",
    passed: true,
    required: 21,
    filled: 12,
    derived: 9,
    missing: 0,
  }),
];

const PUBLICATION = {
  id: "00000000-0000-4000-c000-000000000001",
  relation: "IsSupplementedBy",
  doi: "10.5072/example.2026.001",
  url: null,
  title: "Root growth of Line A and Line B under drought (example)",
  authors: ["Seed User", "Alex Example"],
  year: 2026,
};

type DatasetState = "draft" | "inReview" | "published" | "superseded" | "withdrawn";

interface DatasetDeposit {
  status: "uploading" | "registering" | "verifying" | "deposited" | "failed";
  environment: "sandbox" | "production";
  attempts: number;
  failedStep: "upload" | "register" | "verify" | null;
}

interface DatasetReview {
  frozenAt: string;
  frozenByName: string;
  returnedAt: string | null;
  returnReason: string | null;
}

interface DatasetOverrides {
  state?: DatasetState;
  doi?: string | null;
  deposit?: DatasetDeposit | null;
  supersedesId?: string | null;
  publishedAt?: string | null;
  withdrawnAt?: string | null;
  withdrawalReason?: string | null;
  zenodoCopy?: "requestPrepared" | "removed" | null;
  access?: "open" | "embargoed";
  embargoUntil?: string | null;
  license?: "CC0-1.0" | "CC-BY-4.0" | "CC-BY-SA-4.0" | null;
  scope?: typeof SCOPE_CHOICE | null;
  excludedReadings?: { rowId: string; reason: string }[];
  title?: string;
  description?: string;
  limitations?: string | null;
  authors?: object[];
  contributors?: object[];
  files?: object[];
  relatedPublications?: (typeof PUBLICATION)[];
  studyDetails?: object | null;
  readingCount?: number | null;
  plotCount?: number | null;
  viewCount?: number | null;
  review?: DatasetReview | null;
  createdAt?: string;
}

const EXCLUDED = [
  { rowId: "reading-c4-2026-08-12", reason: "Leaf was wet" },
  { rowId: "reading-d1-2026-08-19", reason: "Border row" },
];

function dataset(id: string, experiment: string, version: number, overrides: DatasetOverrides) {
  return {
    id,
    experimentId: experiment,
    version,
    state: "published",
    title: DATASET_TITLE,
    description: DATASET_DESCRIPTION,
    limitations: DATASET_LIMITATIONS,
    authors: AUTHORS,
    contributors: contributors("accepted"),
    license: "CC-BY-4.0",
    access: "open",
    embargoUntil: null,
    funding: FUNDING,
    relatedPublications: [PUBLICATION],
    scope: SCOPE_CHOICE,
    excludedReadings: EXCLUDED,
    studyDetails: STUDY_DETAILS,
    readingCount: VERSION_1_READINGS,
    plotCount: PLOT_COUNT,
    viewCount: null,
    review: null,
    doi: null,
    deposit: null,
    supersedesId: null,
    files: FILES,
    createdAt: "2026-09-28T09:00:00.000Z",
    publishedAt: null,
    withdrawnAt: null,
    withdrawalReason: null,
    zenodoCopy: null,
    ...overrides,
  };
}

/** Version 1 as milestone 1 publishes it: frozen, approved and public, with no DOI yet. */
function versionOne(experiment: string, overrides: DatasetOverrides = {}) {
  return dataset(VERSION_1_ID, experiment, 1, {
    review: {
      frozenAt: "2026-09-29T15:00:00.000Z",
      frozenByName: "Seed User",
      returnedAt: null,
      returnReason: null,
    },
    publishedAt: "2026-09-30T10:00:00.000Z",
    ...overrides,
  });
}

function deposited(environment: "sandbox" | "production"): DatasetDeposit {
  return { status: "deposited", environment, attempts: 1, failedStep: null };
}

/** Version 2, the correction, before it is frozen. */
function draftVersionTwo(experiment: string, overrides: DatasetOverrides = {}) {
  return dataset(VERSION_2_ID, experiment, 2, {
    state: "draft",
    license: null,
    limitations: null,
    excludedReadings: [],
    files: [],
    studyDetails: null,
    readingCount: null,
    plotCount: null,
    createdAt: "2026-10-18T09:30:00.000Z",
    ...overrides,
  });
}

/** Version 2 frozen and waiting for a data steward, which only the experiment's members see. */
function versionTwoInReview(experiment: string) {
  return draftVersionTwo(experiment, {
    state: "inReview",
    license: "CC-BY-4.0",
    limitations: DATASET_LIMITATIONS,
    files: FILES,
    studyDetails: STUDY_DETAILS,
    readingCount: VERSION_2_READINGS,
    plotCount: PLOT_COUNT,
    review: {
      frozenAt: "2026-10-20T09:40:00.000Z",
      frozenByName: "Seed User",
      returnedAt: null,
      returnReason: null,
    },
  });
}

/** Answers the experiment's dataset list with whatever versions a shot needs. */
function datasetListFixture(build: (experiment: string) => unknown[]): Fixture {
  return {
    install: async (page) => {
      const experiment = await resolve(DROUGHT_TRIAL);
      await page.route(
        (url) => url.pathname === `/api/v1/experiments/${experiment}/datasets`,
        (route) => route.fulfill({ status: 200, json: build(experiment) }),
      );
    },
  };
}

/** Answers fixed paths, some of which carry the experiment's id, which is looked up per run. */
function pathsFixture(build: (experiment: string) => Record<string, unknown>): Fixture {
  return {
    install: async (page) => {
      const bodies = new Map(Object.entries(build(await resolve(DROUGHT_TRIAL))));
      await page.route(
        (url) => bodies.has(url.pathname),
        (route) => {
          const pathname = new URL(route.request().url()).pathname;
          return route.fulfill({ status: 200, json: bodies.get(pathname) });
        },
      );
    },
  };
}

function values(efficiency: string, stressIndex: string) {
  return [
    { column: "efficiency", value: efficiency },
    { column: "stress_index", value: stressIndex },
  ];
}

const FLAGGED_READINGS = [
  {
    rowId: "reading-c4-2026-08-12",
    plot: "C4",
    measuredAt: "2026-08-12T09:31:00.000Z",
    values: values("0.21", "0.88"),
    flagType: "outlier",
    comment: "Leaf was wet",
    flaggedByName: "Seed User",
    flaggedAt: "2026-08-12T09:40:00.000Z",
  },
  {
    rowId: "reading-b2-2026-07-08",
    plot: "B2",
    measuredAt: "2026-07-08T10:02:00.000Z",
    values: values("0.58", "0.34"),
    flagType: "needs_review",
    comment: "Device moved during the reading",
    flaggedByName: "Seed User",
    flaggedAt: "2026-07-08T10:15:00.000Z",
  },
  {
    rowId: "reading-d1-2026-08-19",
    plot: "D1",
    measuredAt: "2026-08-19T08:47:00.000Z",
    values: values("0.12", "0.93"),
    flagType: "outlier",
    comment: "Border row",
    flaggedByName: "Seed User",
    flaggedAt: "2026-08-19T08:55:00.000Z",
  },
];

// The end of the field day in E's session overview: Alex read D6 and D7 in Seed User's share, and
// each of them skipped one plot.
const PLOT_CHECKS = {
  measuredTwice: [
    {
      plot: "D6",
      readings: [
        {
          rowId: "reading-d6-seed",
          measuredByName: "Seed User",
          measuredAt: "2026-08-14T09:25:00.000Z",
          values: values("0.61", "0.29"),
        },
        {
          rowId: "reading-d6-alex",
          measuredByName: "Alex Example",
          measuredAt: "2026-08-14T10:12:00.000Z",
          values: values("0.47", "0.41"),
        },
      ],
    },
    {
      plot: "D7",
      readings: [
        {
          rowId: "reading-d7-seed",
          measuredByName: "Seed User",
          measuredAt: "2026-08-14T09:30:00.000Z",
          values: values("0.66", "0.25"),
        },
        {
          rowId: "reading-d7-alex",
          measuredByName: "Alex Example",
          measuredAt: "2026-08-14T10:15:00.000Z",
          values: values("0.52", "0.37"),
        },
      ],
    },
  ],
  skipped: [
    {
      plot: "A4",
      reason: "flooded",
      skippedByName: "Seed User",
      skippedAt: "2026-08-14T08:45:00.000Z",
    },
    {
      plot: "E4",
      reason: "plantMissing",
      skippedByName: "Alex Example",
      skippedAt: "2026-08-14T08:10:00.000Z",
    },
  ],
};

const NO_PLOT_CHECKS = { measuredTwice: [], skipped: [] };

// The OpenAIRE record is complete because the draft has its authors, license and funding.
const READINESS = {
  floor: {
    filled: ["title", "creators", "publisher", "year", "type", "license", "access", "funding"],
    missing: [],
  },
  standards: [],
};

/** Version 1 as a Draft partway through the publish flow of the first milestone. */
function draftVersionOne(experiment: string, overrides: DatasetOverrides) {
  return dataset(VERSION_1_ID, experiment, 1, {
    state: "draft",
    license: null,
    limitations: null,
    files: [],
    studyDetails: null,
    readingCount: null,
    plotCount: null,
    ...overrides,
  });
}

interface FlowState {
  plotChecks?: typeof PLOT_CHECKS | typeof NO_PLOT_CHECKS;
  /** What the draft has saved so far. */
  draft?: DatasetOverrides;
}

function publishFlowFixture({ plotChecks = NO_PLOT_CHECKS, draft = {} }: FlowState = {}): Fixture {
  return pathsFixture((experiment) => ({
    [`/api/v1/datasets/${VERSION_1_ID}`]: draftVersionOne(experiment, {
      authors: DRAFT_AUTHORS,
      contributors: contributors("accepted"),
      ...draft,
    }),
    [`/api/v1/datasets/${VERSION_1_ID}/scope`]: SCOPE,
    [`/api/v1/datasets/${VERSION_1_ID}/members`]: MEMBERS,
    [`/api/v1/datasets/${VERSION_1_ID}/flagged-readings`]: FLAGGED_READINGS,
    [`/api/v1/datasets/${VERSION_1_ID}/plot-checks`]: plotChecks,
    [`/api/v1/datasets/${VERSION_1_ID}/readiness`]: READINESS,
  }));
}

/** By Freeze everyone named has accepted. */
const READY_TO_FREEZE: FlowState = { draft: { authors: AUTHORS, license: "CC-BY-4.0" } };

// The standards block from B8 comes later than most of these tickets, so their shots leave it out.
const BEFORE_STANDARDS = "?standards=off";

async function publishPath(): Promise<string> {
  return `/platform/experiments/${await resolve(DROUGHT_TRIAL)}/datasets/${VERSION_1_ID}/publish`;
}

async function publishRoute(): Promise<string> {
  return `${await publishPath()}${BEFORE_STANDARDS}`;
}

/** Found by CSS, since an open dialog hides the page from role queries. */
function tabStrip(page: Page): Locator {
  return page.locator("[role='tablist']").first();
}

function nextButton(page: Page): Locator {
  return page.getByRole("button", { name: "Next", exact: true });
}

/** Goes forward through the flow with Next, as a researcher would, ticking what a step needs. */
async function goToStep(page: Page, stepTitle: string): Promise<void> {
  await page.getByTestId("dataset-scope").waitFor();
  for (;;) {
    const current = await page.locator("[aria-current='step']").innerText();
    if (current.includes(stepTitle)) return;
    if (current.includes("License and access")) {
      await page.getByRole("checkbox").check();
    }
    await nextButton(page).click();
    await page.waitForTimeout(300);
  }
}

/** Waits out an opening zoom, which would otherwise skew the outline drawn around a part of it. */
async function settled(element: Locator): Promise<void> {
  await element.evaluate((node) =>
    Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  );
}

async function blurFocus(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
}

/** Hides a later ticket's part of a step, so a shot shows its own ticket's state of the flow. */
async function hideLaterPart(page: Page, testId: string): Promise<void> {
  await page.addStyleTag({ content: `[data-testid='${testId}'] { display: none !important; }` });
}

/** The daily means are switched off and the dates are the whole season. */
const scopeStepShot: TicketShot = {
  slug: "f2-scope-step",
  route: publishRoute,
  viewport: { width: 1440, height: 1500 },
  fixtures: [publishFlowFixture({ draft: { scope: SCOPE_CHOICE } })],
  prepare: async (page) => {
    await goToStep(page, "Scope");
    const choice = page.getByTestId("dataset-scope");
    await choice.getByText(`holds ${EXPERIMENT_READINGS} readings`, { exact: false }).waitFor();
    const heading = page.getByRole("heading", { name: "Publish a dataset" });

    const marker = new ChangeMarker(page);
    await marker.mark(choice, "New", "outside-left");
    return marker.frame([tabStrip(page), heading, nextButton(page)], 24);
  },
};

const curateStepShot: TicketShot = {
  slug: "f4-curate-step",
  route: publishRoute,
  viewport: VIEWPORT,
  fixtures: [publishFlowFixture({ plotChecks: PLOT_CHECKS })],
  prepare: async (page) => {
    await goToStep(page, "Curate");
    const table = page.getByTestId("flagged-readings");
    await table.getByText("Leaf was wet").waitFor();
    await hideLaterPart(page, "plot-checks");

    const marker = new ChangeMarker(page);
    await marker.mark(table, "New", "above");
    return marker.frame([tabStrip(page), nextButton(page)], 24);
  },
};

const measuredTwiceShot: TicketShot = {
  slug: "f19-measured-twice",
  route: publishRoute,
  viewport: { width: 1440, height: 1600 },
  fixtures: [publishFlowFixture({ plotChecks: PLOT_CHECKS })],
  prepare: async (page) => {
    await goToStep(page, "Curate");
    const checks = page.getByTestId("plot-checks");
    await checks.getByText("D7", { exact: true }).waitFor();

    const marker = new ChangeMarker(page);
    await marker.mark(checks, "New", "outside-left");
    return marker.frame([tabStrip(page), nextButton(page)], 24);
  },
};

/** Alex has not answered, Sam was invited by email, Jordan contributes and Kim is neither. */
const describeStepShot: TicketShot = {
  slug: "f2-describe-step",
  route: publishRoute,
  viewport: { width: 1440, height: 2100 },
  fixtures: [publishFlowFixture()],
  prepare: async (page) => {
    await goToStep(page, "Describe");
    const people = page.getByTestId("dataset-people");
    await people.getByText(SAM_EMAIL).waitFor();
    await people.getByTestId("dataset-not-named").getByText("Kim Example").waitFor();
    await blurFocus(page);

    const marker = new ChangeMarker(page);
    await marker.mark(people, "New", "outside-left");
    return marker.frame([tabStrip(page), nextButton(page)], 24);
  },
};

/** CC BY-SA is chosen to show its warning; the example's own license is CC BY. */
const licenseStepShot: TicketShot = {
  slug: "f3-license-step",
  route: publishRoute,
  viewport: { width: 1440, height: 1600 },
  fixtures: [publishFlowFixture(READY_TO_FREEZE)],
  prepare: async (page) => {
    await goToStep(page, "License and access");
    await page.getByRole("radio", { name: /CC BY-SA 4\.0/ }).check();
    await page.getByTestId("share-alike-warning").waitFor();
    await page.getByRole("checkbox").check();
    await blurFocus(page);
    const license = page.getByTestId("dataset-license");

    const marker = new ChangeMarker(page);
    await marker.mark(license, "New", "outside-left");
    return marker.frame([license], 24);
  },
};

// With the standards block in place, its steps are what Freeze waits for, plots measured twice
// among them, so this shot shows B8's steps under the OpenAIRE record.
const checkStepShot: TicketShot = {
  slug: "f5-check-step",
  route: publishPath,
  viewport: { width: 1440, height: 1700 },
  fixtures: [publishFlowFixture({ plotChecks: PLOT_CHECKS }), standards, miappeFields],
  prepare: async (page) => {
    await goToStep(page, "Check");
    const check = page.getByTestId("dataset-check");
    const record = page.getByTestId("openaire-floor");
    await page.getByTestId("followed-standards-check").waitFor();

    // Next stays on Check and turns the steps left red, which is how Freeze waits.
    await nextButton(page).click();
    await page.waitForTimeout(300);
    await blurFocus(page);

    const marker = new ChangeMarker(page);
    await marker.mark(record, "New", "outside-left");
    return marker.frame([tabStrip(page), check, nextButton(page)], 24);
  },
};

/** Goes to Freeze, which the flow reaches only when nothing holds it. */
async function goToFreeze(page: Page): Promise<Locator> {
  await goToStep(page, "Freeze");
  const summary = page.getByTestId("freeze-summary");
  await summary.getByText("Sam Example", { exact: false }).waitFor();
  return summary;
}

function freezeButton(page: Page): Locator {
  return page.getByRole("button", { name: "Freeze version 1", exact: true });
}

const freezeStepShot: TicketShot = {
  slug: "f18-freeze-step",
  route: publishRoute,
  viewport: { width: 1440, height: 1600 },
  fixtures: [publishFlowFixture(READY_TO_FREEZE)],
  prepare: async (page) => {
    const summary = await goToFreeze(page);
    await summary.getByText(`${EXPERIMENT_READINGS} readings`, { exact: false }).waitFor();
    const commits = page.getByTestId("freeze-commits");

    // From the summary down to the button, so the step fits a printed page beside another figure.
    const marker = new ChangeMarker(page);
    await marker.mark([summary, commits], "New", "outside-left");
    return marker.frame([summary, freezeButton(page)], 24);
  },
};

const freezeConfirmShot: TicketShot = {
  slug: "f18-freeze-confirm",
  route: publishRoute,
  viewport: { width: 1440, height: 1600 },
  fixtures: [publishFlowFixture(READY_TO_FREEZE)],
  prepare: async (page) => {
    await goToFreeze(page);
    await freezeButton(page).click();
    const dialog = page.getByTestId("freeze-confirm-dialog");
    await dialog.waitFor();
    await settled(dialog);
    await blurFocus(page);

    const marker = new ChangeMarker(page);
    await marker.mark(dialog, "New", "outside-left");
    return marker.frame([tabStrip(page), page.getByTestId("freeze-summary"), dialog], 24);
  },
};

const citation = (doi: string | null) =>
  `User, S., Example, A., Example, R., & Example, S. (2026). ${DATASET_TITLE} (Version 1) [Data set]. ${PUBLISHER}. ${
    doi === null ? `https://data.openjii.org/datasets/${VERSION_1_ID}` : `https://doi.org/${doi}`
  }`;

interface PublicOverrides extends DatasetOverrides {
  supersededById?: string | null;
  supersededByVersion?: number | null;
  depositEnvironment?: "sandbox" | "production" | null;
}

/** Version 1 as anyone may read it, signed out, in whatever state a shot needs. */
function publicVersionOneFixture(overrides: PublicOverrides = {}): Fixture {
  const {
    supersededById = null,
    supersededByVersion = null,
    depositEnvironment = null,
    ...datasetOverrides
  } = overrides;

  return pathsFixture((experiment) => {
    // A signed-out read never carries the exclusions, the deposit or the review, only how many
    // readings were left out.
    const {
      excludedReadings: _excludedReadings,
      deposit: _deposit,
      review: _review,
      ...record
    } = versionOne(experiment, datasetOverrides);
    return {
      [`/api/v1/datasets/${VERSION_1_ID}/public`]: {
        ...record,
        citation: citation(record.doi),
        publisher: PUBLISHER,
        supersededById,
        supersededByVersion,
        excludedCount: EXCLUDED.length,
        depositEnvironment,
      },
    };
  });
}

const LINK_ICON_PATHS = [
  "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71",
  "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
];

/**
 * The public header reads its links from Contentful, which a local stack cannot reach, so the
 * Datasets entry the ticket adds there is drawn into the fallback header the way a CMS link renders.
 */
async function addHeaderDatasetsLink(page: Page): Promise<Locator> {
  const header = page.locator("header").first();
  await header.getByRole("link", { name: "Platform" }).first().waitFor();
  await page.evaluate((paths) => {
    const platform = [...document.querySelectorAll("header a")].find(
      (anchor) => anchor.textContent.trim() === "Platform",
    );
    if (!(platform instanceof HTMLAnchorElement)) {
      throw new Error("The public header has no Platform link");
    }
    const link = platform.cloneNode(true);
    if (!(link instanceof HTMLAnchorElement)) {
      throw new Error("The cloned link is not a link");
    }
    link.href = "/en-US/datasets";
    link.dataset.testid = "header-datasets-link";
    const icon = link.querySelector("svg");
    if (icon !== null) {
      icon.innerHTML = paths.map((d) => `<path d="${d}"></path>`).join("");
    }
    const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if (node.textContent?.trim() === "Platform") {
        node.textContent = "Datasets";
      }
    }
    platform.after(link);
  }, LINK_ICON_PATHS);
  return header.getByTestId("header-datasets-link");
}

const datasetPageShot: TicketShot = {
  slug: "f8-dataset-page",
  route: `/datasets/${VERSION_1_ID}`,
  anonymous: true,
  viewport: { width: 1440, height: 2300 },
  fixtures: [publicVersionOneFixture()],
  prepare: async (page) => {
    const citeAs = page.getByTestId("dataset-cite-as");
    await citeAs.waitFor();
    const article = page.locator("article");
    const navbar = page.locator("header").first();

    const marker = new ChangeMarker(page);
    await marker.mark(
      [page.getByTestId("dataset-limitations"), page.getByTestId("dataset-about")],
      "New",
      "outside-left",
    );
    await marker.mark(page.getByTestId("dataset-publications"), "New", "outside-left");
    return marker.frame([navbar, article], 24);
  },
};

const embargoedPageShot: TicketShot = {
  slug: "f8-embargoed-page",
  route: `/datasets/${VERSION_1_ID}`,
  anonymous: true,
  viewport: { width: 1440, height: 2300 },
  fixtures: [
    publicVersionOneFixture({ access: "embargoed", embargoUntil: "2027-03-01T12:00:00.000Z" }),
  ],
  prepare: async (page) => {
    const embargo = page.getByTestId("dataset-embargo");
    await embargo.waitFor();
    const article = page.locator("article");
    const navbar = page.locator("header").first();

    const marker = new ChangeMarker(page);
    await marker.mark(embargo, "New", "above");
    return marker.frame([navbar, article], 24);
  },
};

/** The Files section of version 1 once the standard packages are written at freeze. */
const datasetFilesShot: TicketShot = {
  slug: "b5-dataset-files",
  route: `/datasets/${VERSION_1_ID}`,
  anonymous: true,
  viewport: { width: 1280, height: 2600 },
  fixtures: [publicVersionOneFixture({ files: PACKAGE_FILES })],
  prepare: async (page) => {
    const files = page.getByTestId("dataset-files");
    await files.getByTestId("dataset-file-miappe").waitFor();
    const packages = [
      files.getByTestId("dataset-file-analysisTable"),
      files.getByTestId("dataset-file-roCrate"),
      files.getByTestId("dataset-file-miappe"),
    ];

    const marker = new ChangeMarker(page);
    await marker.mark(packages, "New", "outside-left");
    return marker.frame([files], 24);
  },
};

const supersededNoticeShot: TicketShot = {
  slug: "f12-superseded-notice",
  route: `/datasets/${VERSION_1_ID}`,
  anonymous: true,
  viewport: VIEWPORT,
  fixtures: [
    publicVersionOneFixture({
      state: "superseded",
      doi: VERSION_1_DOI,
      supersededById: VERSION_2_ID,
      supersededByVersion: 2,
      depositEnvironment: "production",
    }),
  ],
  prepare: async (page) => {
    const notice = page.getByTestId("dataset-superseded");
    await notice.waitFor();
    await addHeaderDatasetsLink(page);
    const navbar = page.locator("header").first();

    const marker = new ChangeMarker(page);
    await marker.mark(notice, "New", "above");
    return marker.frame([navbar, notice, page.getByTestId("dataset-cite-as")], 24);
  },
};

const tombstoneShot: TicketShot = {
  slug: "f13-tombstone",
  route: `/datasets/${VERSION_1_ID}`,
  anonymous: true,
  viewport: VIEWPORT,
  fixtures: [
    publicVersionOneFixture({
      state: "withdrawn",
      doi: VERSION_1_DOI,
      withdrawnAt: "2026-10-20T10:00:00.000Z",
      withdrawalReason: "Withdrawn at the request of a data owner (example)",
      zenodoCopy: "requestPrepared",
      depositEnvironment: "production",
    }),
  ],
  prepare: async (page) => {
    const notice = page.getByTestId("dataset-withdrawal");
    await notice.waitFor();
    const article = page.locator("article");
    await addHeaderDatasetsLink(page);
    const navbar = page.locator("header").first();

    const marker = new ChangeMarker(page);
    await marker.mark([notice, page.getByTestId("dataset-cite-as")], "New", "above");
    return marker.frame([navbar, article], 24);
  },
};

/** Three published datasets, the drought trial's and two other generic examples. */
function catalogueFixture(experiment: string) {
  return {
    "/api/v1/datasets": [
      versionOne(experiment),
      dataset("00000000-0000-4000-9000-000000000003", "00000000-0000-4000-b000-000000000002", 1, {
        title: "Sensor fleet, spring 2026 (example data)",
        description: "Soil moisture and air temperature from a fleet of field sensors.",
        authors: [AUTHORS[1], AUTHORS[0]],
        license: "CC0-1.0",
        studyDetails: { ...STUDY_DETAILS, subjects: [organism("Zea mays", "4577")] },
        publishedAt: "2026-08-14T10:00:00.000Z",
      }),
      dataset("00000000-0000-4000-9000-000000000004", "00000000-0000-4000-b000-000000000003", 2, {
        title: "Pot trial, summer 2026 (example data)",
        description: "Line A and Line B in pots under two watering regimes.",
        authors: [AUTHORS[2], AUTHORS[3]],
        publishedAt: "2026-07-02T10:00:00.000Z",
      }),
    ],
  };
}

function sidebarEntry(page: Page, name: string): Locator {
  return page
    .locator("[data-sidebar='menu-item']")
    .filter({ has: page.getByText(name, { exact: true }) });
}

const catalogueShot: TicketShot = {
  slug: "f9-datasets-catalogue",
  route: "/platform/datasets",
  viewport: VIEWPORT,
  fixtures: [pathsFixture(catalogueFixture)],
  prepare: async (page) => {
    const catalogue = page.getByTestId("datasets-catalogue");
    await catalogue.getByText("Sensor fleet, spring 2026 (example data)").waitFor();
    const entry = sidebarEntry(page, "Datasets");
    const intro = page.getByText("Every published dataset on openJII", { exact: false });

    const marker = new ChangeMarker(page);
    await marker.mark(entry, "New", "inside-right");
    await marker.mark(catalogue, "New", "below");
    return marker.frame([sidebarEntry(page, "Home"), entry, intro, catalogue], 24);
  },
};

const publicCatalogueShot: TicketShot = {
  slug: "f9-public-catalogue",
  route: "/datasets",
  anonymous: true,
  viewport: VIEWPORT,
  fixtures: [pathsFixture(catalogueFixture)],
  prepare: async (page) => {
    const catalogue = page.getByTestId("datasets-catalogue");
    await catalogue.getByText("Sensor fleet, spring 2026 (example data)").waitFor();
    const headerLink = await addHeaderDatasetsLink(page);
    const navbar = page.locator("header").first();

    const marker = new ChangeMarker(page);
    await marker.mark(headerLink, "New", "below");
    await marker.mark(catalogue, "New", "below");
    return marker.frame([navbar, headerLink, catalogue], 24);
  },
};

/** No table holds publications, so the experiment's list is answered here. */
const publicationsFixture = pathsFixture((experiment) => ({
  [`/api/v1/experiments/${experiment}/publications`]: [PUBLICATION],
}));

const publicationsShot: TicketShot = {
  slug: "f17-publications",
  route: async () => `/platform/experiments/${await resolve(DROUGHT_TRIAL)}`,
  viewport: { width: 1440, height: 1400 },
  fixtures: [publicationsFixture, trialTables, noLinkedWorkbook],
  prepare: async (page) => {
    const section = page.getByTestId("experiment-publications");
    await section.getByText("Root growth of Line A and Line B under drought (example)").waitFor();
    const details = page.getByRole("heading", { name: "Details", exact: true });
    const locations = page.getByRole("heading", { name: "Experiment Locations", exact: true });

    const marker = new ChangeMarker(page);
    await marker.mark(section, "New", "outside-left");
    return marker.frame([tabStrip(page), details, section, locations], 24);
  },
};

async function datasetsRoute(): Promise<string> {
  return `/platform/experiments/${await resolve(DROUGHT_TRIAL)}/datasets${BEFORE_STANDARDS}`;
}

function experimentTitle(page: Page): Locator {
  return page.getByRole("heading", { name: "Drought trial (example data)", exact: true });
}

function datasetsTab(page: Page): Locator {
  return page.getByRole("tab", { name: "Datasets" });
}

function versionRow(page: Page, version: number): Locator {
  return page
    .getByRole("row")
    .filter({ has: page.getByText(`Version ${version}`, { exact: true }) });
}

function datasetsList(page: Page): Locator {
  return page.getByTestId("experiment-datasets");
}

/** Version 2, the correction, frozen and waiting for a data steward while version 1 stays public. */
const datasetsTabShot: TicketShot = {
  slug: "f1-datasets-tab",
  route: datasetsRoute,
  viewport: VIEWPORT,
  fixtures: [
    datasetListFixture((experiment) => [versionTwoInReview(experiment), versionOne(experiment)]),
  ],
  prepare: async (page) => {
    await page.getByText("In review").waitFor();
    const tab = datasetsTab(page);

    const marker = new ChangeMarker(page);
    await marker.mark(tab, "New", "above");
    await marker.mark(datasetsList(page), "New", "below");
    return marker.frame([experimentTitle(page), tab, datasetsList(page)], 24);
  },
};

/** A data steward returned version 2, which is a Draft again with the reason on its row. */
const returnedDraftShot: TicketShot = {
  slug: "f1-returned-draft",
  route: datasetsRoute,
  viewport: VIEWPORT,
  fixtures: [
    datasetListFixture((experiment) => [
      draftVersionTwo(experiment, {
        review: {
          frozenAt: "2026-10-20T09:40:00.000Z",
          frozenByName: "Seed User",
          returnedAt: "2026-10-21T14:05:00.000Z",
          returnReason: "Say in the limitations why one plot is left out (example)",
        },
      }),
      versionOne(experiment),
    ]),
  ],
  prepare: async (page) => {
    const reason = page.getByTestId("dataset-returned");
    await reason.waitFor();

    const marker = new ChangeMarker(page);
    await marker.mark(versionRow(page, 2), "New", "inside-right");
    return marker.frame([experimentTitle(page), datasetsTab(page), datasetsList(page)], 24);
  },
};

/** Version 1 has been public for four weeks, and the Draft has no page to count. */
const viewCountsShot: TicketShot = {
  slug: "f20-view-counts",
  route: datasetsRoute,
  viewport: VIEWPORT,
  fixtures: [
    datasetListFixture((experiment) => [
      draftVersionTwo(experiment),
      versionOne(experiment, { viewCount: 214 }),
    ]),
  ],
  prepare: async (page) => {
    await page.getByText("214 views").waitFor();

    const marker = new ChangeMarker(page);
    await marker.mark(datasetsList(page), "New", "below");
    return marker.frame([experimentTitle(page), datasetsTab(page), datasetsList(page)], 24);
  },
};

/** Opens a row's admin menu, which holds what is done to a dataset already public. */
async function openRowMenu(page: Page, version: number): Promise<Locator> {
  await versionRow(page, version)
    .getByRole("button", { name: `Actions for version ${version}` })
    .click();
  const menu = page.getByRole("menu");
  await menu.waitFor();
  return menu;
}

const embargoRowShot: TicketShot = {
  slug: "f7-embargo-row",
  route: datasetsRoute,
  viewport: VIEWPORT,
  fixtures: [
    datasetListFixture((experiment) => [
      versionOne(experiment, { access: "embargoed", embargoUntil: "2027-03-01T12:00:00.000Z" }),
    ]),
  ],
  prepare: async (page) => {
    await page.getByText("Files open", { exact: false }).waitFor();
    const dateCell = versionRow(page, 1).getByRole("cell").nth(3);

    // An open menu hides the page from role queries, so the row is marked before it opens.
    const marker = new ChangeMarker(page);
    await marker.mark(dateCell, "New", "below");
    const menu = await openRowMenu(page, 1);
    await settled(menu);
    await marker.mark(menu.locator("[role='menuitem']").first(), "New", "outside-left");
    return marker.frame([tabStrip(page), datasetsList(page), menu], 24);
  },
};

const depositStatusShot: TicketShot = {
  slug: "f10-deposit-status",
  route: datasetsRoute,
  viewport: VIEWPORT,
  fixtures: [
    datasetListFixture((experiment) => [
      draftVersionTwo(experiment),
      versionOne(experiment, { doi: SANDBOX_DOI, deposit: deposited("sandbox") }),
    ]),
  ],
  prepare: async (page) => {
    await page.getByText("Test deposit, not citable").waitFor();
    const doiCell = versionRow(page, 1).getByRole("cell").nth(5);

    const marker = new ChangeMarker(page);
    await marker.mark(doiCell, "New", "below");
    return marker.frame([datasetsTab(page), datasetsList(page)], 24);
  },
};

const depositFailedShot: TicketShot = {
  slug: "f10-deposit-failed",
  route: datasetsRoute,
  viewport: VIEWPORT,
  fixtures: [
    datasetListFixture((experiment) => [
      draftVersionTwo(experiment),
      versionOne(experiment, {
        deposit: { status: "failed", environment: "production", attempts: 3, failedStep: "upload" },
      }),
    ]),
  ],
  prepare: async (page) => {
    await page.getByText("Deposit failed").waitFor();
    const doiCell = versionRow(page, 1).getByRole("cell").nth(5);

    const marker = new ChangeMarker(page);
    await marker.mark(doiCell, "New", "below");
    return marker.frame([datasetsTab(page), datasetsList(page)], 24);
  },
};

const versionChainShot: TicketShot = {
  slug: "f12-version-chain",
  route: datasetsRoute,
  viewport: VIEWPORT,
  fixtures: [
    datasetListFixture((experiment) => [
      draftVersionTwo(experiment, {
        state: "published",
        license: "CC-BY-4.0",
        limitations: DATASET_LIMITATIONS,
        files: FILES,
        studyDetails: STUDY_DETAILS,
        readingCount: VERSION_2_READINGS,
        plotCount: PLOT_COUNT,
        doi: VERSION_2_DOI,
        deposit: deposited("production"),
        supersedesId: VERSION_1_ID,
        publishedAt: "2026-10-22T10:00:00.000Z",
      }),
      versionOne(experiment, {
        state: "superseded",
        doi: VERSION_1_DOI,
        deposit: deposited("production"),
      }),
    ]),
  ],
  prepare: async (page) => {
    await page.getByText("Superseded").waitFor();
    await page.getByText(`${VERSION_2_READINGS} readings`).waitFor();
    const rows = [versionRow(page, 2), versionRow(page, 1)];

    const marker = new ChangeMarker(page);
    await marker.mark(rows, "New", "below");
    return marker.frame([datasetsTab(page), datasetsList(page)], 24);
  },
};

const withdrawDialogShot: TicketShot = {
  slug: "f13-withdraw-dialog",
  route: datasetsRoute,
  viewport: VIEWPORT,
  fixtures: [
    datasetListFixture((experiment) => [
      versionOne(experiment, { doi: VERSION_1_DOI, deposit: deposited("production") }),
    ]),
  ],
  prepare: async (page) => {
    await page.getByText(VERSION_1_DOI).waitFor();
    const menu = await openRowMenu(page, 1);
    await menu.getByRole("menuitem", { name: "Withdraw" }).click();
    const dialog = page.getByTestId("dataset-withdraw-dialog");
    await dialog.waitFor();
    await dialog
      .getByRole("textbox", { name: "Reason" })
      .fill("Withdrawn at the request of a data owner (example)");
    await settled(dialog);
    await blurFocus(page);

    const marker = new ChangeMarker(page);
    await marker.mark(dialog, "New", "above");
    return marker.frame([tabStrip(page), datasetsList(page), dialog], 24);
  },
};

// Version 1 the afternoon after it was frozen, beside two other generic examples waiting longer.
const REVIEW_CLOCK = new Date("2026-09-30T08:00:00.000Z");

const reviewFixture = pathsFixture((experiment) => {
  const {
    excludedReadings: _excludedReadings,
    deposit: _deposit,
    review: _review,
    ...record
  } = versionOne(experiment, { state: "inReview", publishedAt: null });

  return {
    "/api/v1/dataset-reviews": [
      {
        id: "00000000-0000-4000-9000-000000000003",
        title: "Sensor fleet, spring 2026 (example data)",
        version: 1,
        experimentName: "Sensor fleet (example data)",
        organizationName: "Example University",
        frozenByName: "Alex Example",
        frozenAt: "2026-09-25T14:20:00.000Z",
      },
      {
        id: "00000000-0000-4000-9000-000000000004",
        title: "Pot trial, summer 2026 (example data)",
        version: 2,
        experimentName: "Pot trial (example data)",
        organizationName: "Example University",
        frozenByName: "Robin Example",
        frozenAt: "2026-09-28T10:05:00.000Z",
      },
      {
        id: VERSION_1_ID,
        title: DATASET_TITLE,
        version: 1,
        experimentName: "Drought trial (example data)",
        organizationName: null,
        frozenByName: "Seed User",
        frozenAt: "2026-09-29T15:00:00.000Z",
      },
    ],
    [`/api/v1/dataset-reviews/${VERSION_1_ID}`]: {
      dataset: {
        ...record,
        citation: citation(null),
        publisher: PUBLISHER,
        supersededById: null,
        supersededByVersion: null,
        excludedCount: EXCLUDED.length,
        depositEnvironment: null,
      },
      experimentName: "Drought trial (example data)",
      frozenByName: "Seed User",
      frozenAt: "2026-09-29T15:00:00.000Z",
      checklist: [
        {
          item: "personalData",
          finding: "no column or value looks like a name, an email address or a phone number",
        },
        { item: "rightToLicense", finding: null },
        { item: "authors", finding: null },
        { item: "description", finding: null },
      ],
    },
  };
});

const reviewQueueShot: TicketShot = {
  slug: "n2-review-queue",
  route: "/platform/datasets/review",
  viewport: VIEWPORT,
  clock: REVIEW_CLOCK,
  fixtures: [reviewFixture],
  prepare: async (page) => {
    const queue = page.getByTestId("review-queue");
    await queue.getByText(DATASET_TITLE).waitFor();
    const heading = page.getByRole("heading", { name: "Review datasets" });

    const marker = new ChangeMarker(page);
    await marker.mark(queue, "New", "below");
    return marker.frame([heading, queue], 24);
  },
};

/** Two points confirmed, so Approve still waits for the other two. */
const reviewPageShot: TicketShot = {
  slug: "n2-review-page",
  route: `/platform/datasets/review/${VERSION_1_ID}`,
  viewport: { width: 1440, height: 1300 },
  clock: REVIEW_CLOCK,
  fixtures: [reviewFixture],
  prepare: async (page) => {
    const checklist = page.getByTestId("review-checklist");
    await checklist.getByText("openJII found", { exact: false }).waitFor();
    await checklist.getByRole("checkbox").nth(0).check();
    await checklist.getByRole("checkbox").nth(1).check();
    await blurFocus(page);
    const heading = page.getByRole("heading", { name: "Review a dataset" });
    const preview = page.getByTestId("review-preview");

    const marker = new ChangeMarker(page);
    await marker.mark(checklist, "New", "inside-top-right");
    await marker.mark(page.getByTestId("dataset-preview"), "New", "above");
    return marker.frame([heading, checklist, preview], 24);
  },
};

export const SHOTS_F: readonly TicketShot[] = [
  reviewQueueShot,
  reviewPageShot,
  datasetsTabShot,
  returnedDraftShot,
  scopeStepShot,
  curateStepShot,
  describeStepShot,
  licenseStepShot,
  checkStepShot,
  embargoRowShot,
  datasetPageShot,
  embargoedPageShot,
  datasetFilesShot,
  catalogueShot,
  publicCatalogueShot,
  depositStatusShot,
  depositFailedShot,
  versionChainShot,
  supersededNoticeShot,
  withdrawDialogShot,
  tombstoneShot,
  publicationsShot,
  freezeStepShot,
  freezeConfirmShot,
  measuredTwiceShot,
  viewCountsShot,
];
