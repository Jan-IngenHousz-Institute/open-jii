import type { Locator, Page } from "@playwright/test";

import { experimentId } from "../docs-media/seed-entities.js";
import { ChangeMarker } from "./change-marker.js";
import type { Fixture, Resolvable } from "./fixture.js";
import { resolve } from "./fixture.js";
import { miappeFields, noLinkedWorkbook, standards, trialTables } from "./shots-b.js";
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
const STUDY_DETAILS = {
  organism: "Glycine max",
  startDate: "2026-05-04",
  endDate: "2026-09-25",
  experimentalDesign: "Randomized complete blocks, three treatments in three blocks",
  growthFacility: "Open field",
};

// Version 1 froze before the last phone synced a field day of 46 plots, which version 2 adds.
const VERSION_1_READINGS = 920;
const READING_COUNT = 966;
const PLOT_COUNT = 46;

const AUTHORS = [
  {
    userId: "00000000-0000-4000-a000-000000000001",
    givenName: "Seed",
    familyName: "User",
    orcid: "0000-0002-1825-0097",
    affiliation: "Example University",
  },
  {
    userId: "00000000-0000-4000-a000-000000000002",
    givenName: "Alex",
    familyName: "Example",
    orcid: null,
    affiliation: "Example University",
  },
  {
    userId: "00000000-0000-4000-a000-000000000003",
    givenName: "Robin",
    familyName: "Example",
    orcid: null,
    affiliation: "Example University",
  },
  { userId: null, givenName: "Sam", familyName: "Example", orcid: null, affiliation: null },
];

const FILES = [
  {
    kind: "snapshot",
    name: "readings.csv",
    sizeBytes: 193_240,
    sha256: "3f1c9a52e0b84d7c6a1e2f9b0d4c8a7e5b3f2a1c0d9e8f7a6b5c4d3e2f1a0b9c",
  },
  {
    kind: "dataDictionary",
    name: "data-dictionary.csv",
    sizeBytes: 4_812,
    sha256: "9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b",
  },
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

type DatasetState = "draft" | "published" | "superseded" | "withdrawn";

interface DatasetDeposit {
  status: "uploading" | "registering" | "verifying" | "deposited" | "failed";
  environment: "sandbox" | "production";
  attempts: number;
  failedStep: "upload" | "register" | "verify" | null;
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
  license?: "CC0-1.0" | "CC-BY-4.0" | null;
  excludedReadings?: { rowId: string; reason: string }[];
  title?: string;
  description?: string;
  limitations?: string | null;
  authors?: (typeof AUTHORS)[number][];
  files?: typeof FILES;
  relatedPublications?: (typeof PUBLICATION)[];
  studyDetails?: typeof STUDY_DETAILS | null;
  readingCount?: number | null;
  plotCount?: number | null;
  createdAt?: string;
}

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
    license: "CC-BY-4.0",
    access: "open",
    embargoUntil: null,
    funding: FUNDING,
    relatedPublications: [PUBLICATION],
    excludedReadings: [],
    studyDetails: STUDY_DETAILS,
    readingCount: READING_COUNT,
    plotCount: PLOT_COUNT,
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

/** Version 1 as milestone 1 publishes it: frozen and public, with no DOI yet. */
function versionOne(experiment: string, overrides: DatasetOverrides = {}) {
  return dataset(VERSION_1_ID, experiment, 1, {
    readingCount: VERSION_1_READINGS,
    publishedAt: "2026-09-30T10:00:00.000Z",
    ...overrides,
  });
}

function deposited(environment: "sandbox" | "production"): DatasetDeposit {
  return { status: "deposited", environment, attempts: 1, failedStep: null };
}

function draftVersionTwo(experiment: string, overrides: DatasetOverrides = {}) {
  return dataset(VERSION_2_ID, experiment, 2, {
    state: "draft",
    license: null,
    limitations: null,
    files: [],
    studyDetails: null,
    readingCount: null,
    plotCount: null,
    createdAt: "2026-10-18T09:30:00.000Z",
    ...overrides,
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

/** Version 2 as a Draft partway through the publish flow, with what it has saved so far. */
function publishFlowFixture(plotChecks: typeof PLOT_CHECKS | typeof NO_PLOT_CHECKS): Fixture {
  return pathsFixture((experiment) => ({
    [`/api/v1/datasets/${VERSION_2_ID}`]: draftVersionTwo(experiment, {
      access: "embargoed",
      embargoUntil: "2027-03-01T12:00:00.000Z",
      excludedReadings: [
        { rowId: "reading-c4-2026-08-12", reason: "Leaf was wet" },
        { rowId: "reading-d1-2026-08-19", reason: "Border row" },
      ],
    }),
    [`/api/v1/datasets/${VERSION_2_ID}/scope`]: {
      version: 2,
      readingCount: READING_COUNT,
      countedAt: "2026-10-20T09:00:00.000Z",
      previous: { version: 1, readingCount: VERSION_1_READINGS },
    },
    [`/api/v1/datasets/${VERSION_2_ID}/flagged-readings`]: FLAGGED_READINGS,
    [`/api/v1/datasets/${VERSION_2_ID}/plot-checks`]: plotChecks,
    [`/api/v1/datasets/${VERSION_2_ID}/readiness`]: READINESS,
  }));
}

// The standards block from B8 comes later than most of these tickets, so their shots leave it out.
const BEFORE_STANDARDS = "?standards=off";

async function publishPath(): Promise<string> {
  return `/platform/experiments/${await resolve(DROUGHT_TRIAL)}/datasets/${VERSION_2_ID}/publish`;
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
  await page.getByText("What this dataset will hold").waitFor();
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

const scopeStepShot: TicketShot = {
  slug: "f2-scope-step",
  route: publishRoute,
  viewport: VIEWPORT,
  fixtures: [publishFlowFixture(NO_PLOT_CHECKS)],
  prepare: async (page) => {
    await goToStep(page, "Scope");
    await page.getByText(`${READING_COUNT} so far`, { exact: false }).first().waitFor();
    const heading = page.getByRole("heading", { name: "Publish a dataset" });
    const note = page.getByText("Making the experiment public", { exact: false });
    const scopeCard = page.getByText("What this dataset will hold");

    const marker = new ChangeMarker(page);
    await marker.mark([scopeCard, note], "New", "outside-left");
    return marker.frame([tabStrip(page), heading, nextButton(page)], 24);
  },
};

const curateStepShot: TicketShot = {
  slug: "f4-curate-step",
  route: publishRoute,
  viewport: VIEWPORT,
  fixtures: [publishFlowFixture(PLOT_CHECKS)],
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
  fixtures: [publishFlowFixture(PLOT_CHECKS)],
  prepare: async (page) => {
    await goToStep(page, "Curate");
    const checks = page.getByTestId("plot-checks");
    await checks.getByText("D7", { exact: true }).waitFor();

    const marker = new ChangeMarker(page);
    await marker.mark(checks, "New", "outside-left");
    return marker.frame([tabStrip(page), nextButton(page)], 24);
  },
};

const describeStepShot: TicketShot = {
  slug: "f2-describe-step",
  route: publishRoute,
  viewport: { width: 1440, height: 1900 },
  fixtures: [publishFlowFixture(NO_PLOT_CHECKS)],
  prepare: async (page) => {
    await goToStep(page, "Describe");
    const authors = page.getByTestId("dataset-authors");
    await authors.getByText("Sam Example").waitFor();
    await authors.getByRole("button", { name: "Add an author" }).click();
    await page.getByRole("menuitem", { name: "By name" }).click();
    await authors.getByTestId("add-author-by-name").waitFor();
    await blurFocus(page);

    const marker = new ChangeMarker(page);
    await marker.mark(authors, "New", "outside-left");
    return marker.frame([tabStrip(page), nextButton(page)], 24);
  },
};

const licenseStepShot: TicketShot = {
  slug: "f3-license-step",
  route: publishRoute,
  viewport: { width: 1440, height: 1600 },
  fixtures: [publishFlowFixture(NO_PLOT_CHECKS)],
  prepare: async (page) => {
    await goToStep(page, "License and access");
    await page.getByRole("checkbox").check();
    await blurFocus(page);
    const body = page.getByTestId("license-and-access");

    const marker = new ChangeMarker(page);
    await marker.mark(body, "New", "outside-left");
    return marker.frame([tabStrip(page), nextButton(page)], 24);
  },
};

// With the standards block in place, its steps are what Freeze waits for, plots measured twice
// among them, so this shot shows B8's steps under the OpenAIRE record.
const checkStepShot: TicketShot = {
  slug: "f5-check-step",
  route: publishPath,
  viewport: { width: 1440, height: 1700 },
  fixtures: [publishFlowFixture(PLOT_CHECKS), standards, miappeFields],
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
  return page.getByRole("button", { name: "Freeze version 2", exact: true });
}

const freezeStepShot: TicketShot = {
  slug: "f18-freeze-step",
  route: publishRoute,
  viewport: { width: 1440, height: 1600 },
  fixtures: [publishFlowFixture(NO_PLOT_CHECKS)],
  prepare: async (page) => {
    const summary = await goToFreeze(page);
    const commits = page.getByTestId("freeze-commits");

    const marker = new ChangeMarker(page);
    await marker.mark([summary, commits], "New", "outside-left");
    return marker.frame([tabStrip(page), freezeButton(page)], 24);
  },
};

const freezeConfirmShot: TicketShot = {
  slug: "f18-freeze-confirm",
  route: publishRoute,
  viewport: { width: 1440, height: 1600 },
  fixtures: [publishFlowFixture(NO_PLOT_CHECKS)],
  prepare: async (page) => {
    await goToFreeze(page);
    await freezeButton(page).click();
    const dialog = page.getByTestId("freeze-confirm-dialog");
    await dialog.waitFor();
    await settled(dialog);
    await blurFocus(page);

    const marker = new ChangeMarker(page);
    await marker.mark(dialog, "New", "above");
    return marker.frame([tabStrip(page), page.getByTestId("freeze-summary"), dialog], 24);
  },
};

const citation = (doi: string | null) =>
  `User, S., Example, A., Example, R., & Example, S. (2026). ${DATASET_TITLE} (Version 1) [Data set]. ${PUBLISHER}. ${
    doi === null ? `https://openjii.org/datasets/${VERSION_1_ID}` : `https://doi.org/${doi}`
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
    // A signed-out read never carries the exclusions or the deposit, only how many were left out.
    const {
      excludedReadings: _excludedReadings,
      deposit: _deposit,
      ...record
    } = versionOne(experiment, datasetOverrides);
    return {
      [`/api/v1/datasets/${VERSION_1_ID}/public`]: {
        ...record,
        citation: citation(record.doi),
        publisher: PUBLISHER,
        supersededById,
        supersededByVersion,
        excludedCount: 2,
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
      (anchor) => anchor.textContent?.trim() === "Platform",
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
        studyDetails: { ...STUDY_DETAILS, organism: "Zea mays" },
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

const datasetsTabShot: TicketShot = {
  slug: "f1-datasets-tab",
  route: datasetsRoute,
  viewport: VIEWPORT,
  fixtures: [
    datasetListFixture((experiment) => [draftVersionTwo(experiment), versionOne(experiment)]),
  ],
  prepare: async (page) => {
    await page.getByText(DATASET_TITLE).first().waitFor();
    const tab = datasetsTab(page);

    const marker = new ChangeMarker(page);
    await marker.mark(tab, "New", "above");
    await marker.mark(datasetsList(page), "New", "below");
    return marker.frame([experimentTitle(page), tab, datasetsList(page)], 24);
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
        files: FILES,
        studyDetails: STUDY_DETAILS,
        readingCount: READING_COUNT,
        plotCount: PLOT_COUNT,
        doi: VERSION_2_DOI,
        deposit: deposited("production"),
        supersedesId: VERSION_1_ID,
        publishedAt: "2026-10-20T10:00:00.000Z",
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

export const SHOTS_F: readonly TicketShot[] = [
  datasetsTabShot,
  scopeStepShot,
  curateStepShot,
  describeStepShot,
  licenseStepShot,
  checkStepShot,
  embargoRowShot,
  datasetPageShot,
  embargoedPageShot,
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
];
