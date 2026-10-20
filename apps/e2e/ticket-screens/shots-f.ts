import type { Locator, Page } from "@playwright/test";

import { experimentId } from "../docs-media/seed-entities.js";
import { ChangeMarker } from "./change-marker.js";
import type { Fixture, Resolvable } from "./fixture.js";
import { resolve } from "./fixture.js";
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
const VERSION_1_DOI = "10.5281/zenodo.0000000";
const VERSION_2_DOI = "10.5281/zenodo.0000001";
// Zenodo's sandbox issues test DOIs under its own prefix.
const SANDBOX_DOI = "10.5072/zenodo.0000000";
const PUBLISHER = "Jan IngenHousz Institute";
const FUNDING = [{ funderName: "Example Research Council", awardNumber: "EX-2026-001" }];

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

type DatasetState = "draft" | "published" | "superseded" | "withdrawn";

interface DatasetOverrides {
  state?: DatasetState;
  doi?: string | null;
  deposit?: { status: "deposited"; environment: "sandbox"; attempts: number } | null;
  supersedesId?: string | null;
  publishedAt?: string | null;
  withdrawnAt?: string | null;
  withdrawalReason?: string | null;
  access?: "open" | "embargoed";
  embargoUntil?: string | null;
  license?: "CC0-1.0" | "CC-BY-4.0" | null;
  excludedReadings?: { rowId: string; reason: string }[];
  title?: string;
  description?: string;
  authors?: (typeof AUTHORS)[number][];
  files?: typeof FILES;
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
    limitations: null,
    authors: AUTHORS,
    license: "CC-BY-4.0",
    access: "open",
    embargoUntil: null,
    funding: FUNDING,
    relatedPublications: [],
    excludedReadings: [],
    doi: null,
    deposit: null,
    supersedesId: null,
    files: FILES,
    createdAt: "2026-09-28T09:00:00.000Z",
    publishedAt: null,
    withdrawnAt: null,
    withdrawalReason: null,
    ...overrides,
  };
}

function versionOne(experiment: string, overrides: DatasetOverrides = {}) {
  return dataset(VERSION_1_ID, experiment, 1, {
    doi: VERSION_1_DOI,
    publishedAt: "2026-09-30T10:00:00.000Z",
    ...overrides,
  });
}

function draftVersionTwo(experiment: string, overrides: DatasetOverrides = {}) {
  return dataset(VERSION_2_ID, experiment, 2, {
    state: "draft",
    license: null,
    files: [],
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

const FLAGGED_READINGS = [
  {
    rowId: "reading-c4-2026-08-12",
    plot: "C4",
    flagType: "outlier",
    comment: "Leaf was wet",
    flaggedByName: "Seed User",
    flaggedAt: "2026-08-12T09:40:00.000Z",
  },
  {
    rowId: "reading-b2-2026-07-08",
    plot: "B2",
    flagType: "needs_review",
    comment: "Device moved during the reading",
    flaggedByName: "Seed User",
    flaggedAt: "2026-07-08T10:15:00.000Z",
  },
  {
    rowId: "reading-d1-2026-08-19",
    plot: "D1",
    flagType: "outlier",
    comment: "Border row",
    flaggedByName: "Seed User",
    flaggedAt: "2026-08-19T08:55:00.000Z",
  },
];

// The B8 readiness screen's rows, with the floor complete because the draft has its authors,
// license and funding.
const READINESS = {
  floor: {
    filled: ["title", "creators", "publisher", "year", "type", "license", "access", "funding"],
    missing: [],
  },
  standards: [
    {
      standard: "miappe",
      verdict: "partial",
      filled: 14,
      total: 22,
      reason: "8 fields cannot be filled yet, so the validator does not pass",
    },
    {
      standard: "brapi",
      verdict: "met",
      filled: null,
      total: null,
      reason: "All 4 calls answer and pass the conformance tool",
    },
    {
      standard: "cropOntology",
      verdict: "partial",
      filled: 2,
      total: 6,
      reason: "Two of six described columns carry a term",
    },
    {
      standard: "greenhouseOntology",
      verdict: "notApplicable",
      filled: null,
      total: null,
      reason: "The layout's unit, Plot, is a field plot with no greenhouse term",
    },
    {
      standard: "sensorThings",
      verdict: "notApplicable",
      filled: null,
      total: null,
      reason: "Under evaluation: the platform has not decided whether to serve it",
    },
    {
      standard: "fair",
      verdict: "notAssessed",
      filled: null,
      total: null,
      reason: "Assessed once the dataset is published",
    },
  ],
};

// 46 plots measured weekly from 4 May to 25 September.
const READING_COUNT = 966;

/** Version 2 as a Draft partway through the publish flow, with what it has saved so far. */
const publishFlowFixture = pathsFixture((experiment) => ({
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
  },
  [`/api/v1/datasets/${VERSION_2_ID}/flagged-readings`]: FLAGGED_READINGS,
  [`/api/v1/datasets/${VERSION_2_ID}/readiness`]: READINESS,
}));

async function publishRoute(): Promise<string> {
  return `/platform/experiments/${await resolve(DROUGHT_TRIAL)}/datasets/${VERSION_2_ID}/publish`;
}

function stepIndicator(page: Page): Locator {
  return page.locator("[aria-current='step']").locator("xpath=..");
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

const scopeStepShot: TicketShot = {
  slug: "f2-scope-step",
  route: publishRoute,
  viewport: VIEWPORT,
  fixtures: [publishFlowFixture],
  prepare: async (page) => {
    await goToStep(page, "Scope");
    await page.getByText(`${READING_COUNT} so far`, { exact: false }).waitFor();
    const heading = page.getByRole("heading", { name: "Publish a dataset" });

    const marker = new ChangeMarker(page);
    return marker.frame([heading, nextButton(page)], 24);
  },
};

const curateStepShot: TicketShot = {
  slug: "f4-curate-step",
  route: publishRoute,
  viewport: VIEWPORT,
  fixtures: [publishFlowFixture],
  prepare: async (page) => {
    await goToStep(page, "Curate");
    const table = page.getByTestId("flagged-readings");
    await table.getByText("Leaf was wet").waitFor();

    const marker = new ChangeMarker(page);
    await marker.mark(table, "New", "above");
    return marker.frame([stepIndicator(page), nextButton(page)], 24);
  },
};

const describeStepShot: TicketShot = {
  slug: "f2-describe-step",
  route: publishRoute,
  viewport: { width: 1440, height: 1500 },
  fixtures: [publishFlowFixture],
  prepare: async (page) => {
    await goToStep(page, "Describe");
    const authors = page.getByTestId("dataset-authors");
    await authors.getByText("Sam Example").waitFor();

    const marker = new ChangeMarker(page);
    await marker.mark(authors, "New", "inside-top-right");
    return marker.frame([stepIndicator(page), nextButton(page)], 24);
  },
};

const licenseStepShot: TicketShot = {
  slug: "f3-license-step",
  route: publishRoute,
  viewport: { width: 1440, height: 1400 },
  fixtures: [publishFlowFixture],
  prepare: async (page) => {
    await goToStep(page, "License and access");
    await page.getByRole("checkbox").check();
    const body = page.getByTestId("license-and-access");

    const marker = new ChangeMarker(page);
    await marker.mark(body, "New", "above");
    return marker.frame([stepIndicator(page), nextButton(page)], 24);
  },
};

const checkStepShot: TicketShot = {
  slug: "f5-check-step",
  route: publishRoute,
  viewport: { width: 1440, height: 1400 },
  fixtures: [publishFlowFixture],
  prepare: async (page) => {
    await goToStep(page, "Check");
    const floor = page.getByTestId("openaire-floor");
    await floor.waitFor();
    const miappe = page
      .getByTestId("dataset-check")
      .getByRole("listitem")
      .filter({ hasText: "MIAPPE" });

    const marker = new ChangeMarker(page);
    await marker.mark([floor, miappe], "New", "inside-right");
    return marker.frame([stepIndicator(page), nextButton(page)], 24);
  },
};

const CITATION = `User, S., Example, A., Example, R., & Example, S. (2026). ${DATASET_TITLE} (Version 1) [Data set]. ${PUBLISHER}. https://doi.org/${VERSION_1_DOI}`;

/** Version 1 as anyone may read it, signed out, in whatever state a shot needs. */
function publicVersionOneFixture(overrides: DatasetOverrides = {}): Fixture {
  return pathsFixture((experiment) => {
    // A signed-out read never carries the exclusions, the deposit or the draft-only fields.
    const {
      excludedReadings: _excludedReadings,
      deposit: _deposit,
      limitations: _limitations,
      ...record
    } = versionOne(experiment, overrides);
    return {
      [`/api/v1/datasets/${VERSION_1_ID}/public`]: {
        ...record,
        citation: CITATION,
        publisher: PUBLISHER,
        supersededById: null,
      },
    };
  });
}

const datasetPageShot: TicketShot = {
  slug: "f8-dataset-page",
  route: `/datasets/${VERSION_1_ID}`,
  anonymous: true,
  viewport: { width: 1440, height: 1500 },
  fixtures: [publicVersionOneFixture()],
  prepare: async (page) => {
    const citeAs = page.getByTestId("dataset-cite-as");
    await citeAs.waitFor();
    const article = page.locator("article");

    // The public navbar's sign-in link shows the page was opened signed out.
    const navbar = page.locator("header").first();

    const marker = new ChangeMarker(page);
    await marker.mark(citeAs, "New", "above");
    return marker.frame([navbar, article], 24);
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
      withdrawnAt: "2026-10-20T10:00:00.000Z",
      withdrawalReason: "Withdrawn at the request of a data owner (example)",
    }),
  ],
  prepare: async (page) => {
    const notice = page.getByTestId("dataset-withdrawal");
    await notice.waitFor();
    const article = page.locator("article");

    const navbar = page.locator("header").first();

    const marker = new ChangeMarker(page);
    await marker.mark(notice, "New", "above");
    return marker.frame([navbar, article], 24);
  },
};

/** Three published datasets, the drought trial's and two other generic examples. */
const catalogueFixture = pathsFixture((experiment) => ({
  "/api/v1/datasets": [
    versionOne(experiment),
    dataset("00000000-0000-4000-9000-000000000003", "00000000-0000-4000-b000-000000000002", 1, {
      title: "Sensor fleet, spring 2026 (example data)",
      description: "Soil moisture and air temperature from a fleet of field sensors.",
      authors: [AUTHORS[1], AUTHORS[0]],
      license: "CC0-1.0",
      doi: "10.5281/zenodo.0000002",
      publishedAt: "2026-08-14T10:00:00.000Z",
    }),
    dataset("00000000-0000-4000-9000-000000000004", "00000000-0000-4000-b000-000000000003", 1, {
      title: "Pot trial, summer 2026 (example data)",
      description: "Line A and Line B in pots under two watering regimes.",
      authors: [AUTHORS[2], AUTHORS[3]],
      doi: "10.5281/zenodo.0000003",
      publishedAt: "2026-07-02T10:00:00.000Z",
    }),
  ],
}));

function sidebarEntry(page: Page, name: string): Locator {
  return page
    .locator("[data-sidebar='menu-item']")
    .filter({ has: page.getByText(name, { exact: true }) });
}

const catalogueShot: TicketShot = {
  slug: "f9-datasets-catalogue",
  route: "/platform/datasets",
  viewport: VIEWPORT,
  fixtures: [catalogueFixture],
  prepare: async (page) => {
    const catalogue = page.getByTestId("datasets-catalogue");
    await catalogue.getByText("Sensor fleet, spring 2026 (example data)").waitFor();
    const entry = sidebarEntry(page, "Datasets");
    const table = catalogue.locator("table");

    const intro = page.getByText("Every published dataset on openJII", { exact: false });

    const marker = new ChangeMarker(page);
    await marker.mark(entry, "New", "inside-right");
    await marker.mark(table, "New", "below");
    return marker.frame([sidebarEntry(page, "Home"), entry, intro, catalogue], 24);
  },
};

/** No table holds publications, so the experiment's list is answered here. */
const publicationsFixture = pathsFixture((experiment) => ({
  [`/api/v1/experiments/${experiment}/publications`]: [
    {
      id: "00000000-0000-4000-c000-000000000001",
      relation: "IsSupplementedBy",
      doi: "10.5072/example.2026.001",
      url: null,
      title: "Root growth of Line A and Line B under drought (example)",
      authors: ["Seed User", "Alex Example"],
      year: 2026,
    },
  ],
}));

const publicationsShot: TicketShot = {
  slug: "f17-publications",
  route: async () => `/platform/experiments/${await resolve(DROUGHT_TRIAL)}`,
  viewport: VIEWPORT,
  fixtures: [publicationsFixture],
  prepare: async (page) => {
    const section = page.getByTestId("experiment-publications");
    await section.getByText("Root growth of Line A and Line B under drought (example)").waitFor();
    const details = page.getByRole("heading", { name: "Details", exact: true });
    const locations = page.getByRole("heading", { name: "Experiment Locations", exact: true });

    const marker = new ChangeMarker(page);
    await marker.mark(section, "New", "inside-right");
    return marker.frame([details, section, locations], 24);
  },
};

async function datasetsRoute(): Promise<string> {
  return `/platform/experiments/${await resolve(DROUGHT_TRIAL)}/datasets`;
}

function experimentTitle(page: Page): Locator {
  return page.getByRole("heading", { name: "Drought trial (example data)", exact: true });
}

function datasetsTab(page: Page): Locator {
  return page.getByRole("tab", { name: "Datasets" });
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
    const list = page.getByTestId("experiment-datasets");

    const marker = new ChangeMarker(page);
    await marker.mark(tab, "New", "above");
    await marker.mark(list, "New", "below");
    return marker.frame([experimentTitle(page), tab, list], 24);
  },
};

function versionRow(page: Page, version: number): Locator {
  return page
    .getByRole("row")
    .filter({ has: page.getByText(`Version ${version}`, { exact: true }) });
}

const depositStatusShot: TicketShot = {
  slug: "f10-deposit-status",
  route: datasetsRoute,
  viewport: VIEWPORT,
  fixtures: [
    datasetListFixture((experiment) => [
      draftVersionTwo(experiment),
      versionOne(experiment, {
        doi: SANDBOX_DOI,
        deposit: { status: "deposited", environment: "sandbox", attempts: 1 },
      }),
    ]),
  ],
  prepare: async (page) => {
    await page.getByText("Deposited").waitFor();
    const doiCell = versionRow(page, 1).getByRole("cell").nth(4);
    const list = page.getByTestId("experiment-datasets");

    const marker = new ChangeMarker(page);
    await marker.mark(doiCell, "New", "below");
    return marker.frame([datasetsTab(page), list], 24);
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
        doi: VERSION_2_DOI,
        supersedesId: VERSION_1_ID,
        publishedAt: "2026-10-20T10:00:00.000Z",
      }),
      versionOne(experiment, { state: "superseded" }),
    ]),
  ],
  prepare: async (page) => {
    await page.getByText("Superseded").waitFor();
    const rows = [versionRow(page, 2), versionRow(page, 1)];
    const list = page.getByTestId("experiment-datasets");

    const marker = new ChangeMarker(page);
    await marker.mark(rows, "New", "inside-right");
    return marker.frame([datasetsTab(page), list], 24);
  },
};

export const SHOTS_F: readonly TicketShot[] = [
  datasetsTabShot,
  scopeStepShot,
  curateStepShot,
  describeStepShot,
  licenseStepShot,
  checkStepShot,
  datasetPageShot,
  catalogueShot,
  depositStatusShot,
  versionChainShot,
  tombstoneShot,
  publicationsShot,
];
