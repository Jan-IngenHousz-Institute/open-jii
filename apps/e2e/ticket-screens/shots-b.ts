import type { Locator, Page } from "@playwright/test";

import { experimentId } from "../docs-media/seed-entities.js";
import { ChangeMarker } from "./change-marker.js";
import { examplePlots } from "./example-field.js";
import type { FixtureRow, FixtureTable } from "./fixture-tables.js";
import { FixtureWarehouse } from "./fixture-warehouse.js";
import type { Fixture, Resolvable } from "./fixture.js";
import { resolve } from "./fixture.js";
import type { TicketShot } from "./shots.js";

export const DROUGHT_TRIAL: Resolvable = () => experimentId("Drought trial (example data)");

/** Answers one experiment sub-path, whatever the experiment id, with a fixed body. */
function experimentRoute(subPath: string, body: unknown): Fixture {
  return {
    install: async (page) => {
      await page.route(
        (url) => url.pathname.startsWith("/api/v1/experiments/") && url.pathname.endsWith(subPath),
        (route) => route.fulfill({ status: 200, json: body }),
      );
    },
  };
}

const dataColumn = (name: string, type: string) => ({ name, type_name: type, type_text: type });

// The a5 data dictionary's two tables, row for row, so every screen counts the same columns and
// rows. The raw table also carries the plot columns c7 adds.
const RAW_ROWS = 1240;
const DAILY_MEAN_ROWS = 96;

function rawDataRows(): FixtureRow[] {
  const plots = examplePlots();
  return Array.from({ length: RAW_ROWS }, (_, index) => {
    const plot = plots[index % plots.length];
    const walk = Math.floor(index / plots.length);
    const isHumidityMissing = index % 20 === 0 && index < 1200;
    return {
      timestamp: new Date(
        Date.UTC(2026, 4, 18 + walk * 5, 8, (index % plots.length) * 2),
      ).toISOString(),
      Plot: plot.identifier,
      Treatment: plot.treatment,
      Genotype: plot.genotype,
      Block: plot.block,
      leaf_temperature: Number((24 + ((index * 7) % 60) / 10).toFixed(1)),
      light_intensity: 400 + ((index * 37) % 900),
      relative_humidity: isHumidityMissing ? null : 40 + ((index * 13) % 40),
    };
  });
}

function dailyMeanRows(): FixtureRow[] {
  return Array.from({ length: DAILY_MEAN_ROWS }, (_, index) => ({
    daily_mean_temperature: Number((25 + ((index * 3) % 40) / 10).toFixed(1)),
    daily_mean_light: 650 + ((index * 29) % 300),
    quality_flag: index % 9 === 4 ? "fail" : "pass",
  }));
}

const RAW_DATA_TABLE: FixtureTable = {
  identifier: "raw_data",
  displayName: "Raw Data",
  columns: [
    dataColumn("timestamp", "TIMESTAMP"),
    dataColumn("Plot", "STRING"),
    dataColumn("Treatment", "STRING"),
    dataColumn("Genotype", "STRING"),
    dataColumn("Block", "STRING"),
    dataColumn("leaf_temperature", "DOUBLE"),
    dataColumn("light_intensity", "DOUBLE"),
    dataColumn("relative_humidity", "DOUBLE"),
  ],
  rows: rawDataRows(),
  defaultSortColumn: "timestamp",
};

const DAILY_MEANS_TABLE: FixtureTable = {
  identifier: "00000000-0000-4000-8000-0000000000a5",
  displayName: "Processed Data (Daily means)",
  columns: [
    dataColumn("daily_mean_temperature", "DOUBLE"),
    dataColumn("daily_mean_light", "DOUBLE"),
    dataColumn("quality_flag", "STRING"),
  ],
  rows: dailyMeanRows(),
};

export const trialTables = new FixtureWarehouse(DROUGHT_TRIAL, [RAW_DATA_TABLE, DAILY_MEANS_TABLE]);

type FieldSource = "experiment" | "study-details" | "layout" | "data-dictionary" | "profile";

function filled(field: string, value: string, source: FieldSource) {
  return { field, status: "filled", value, source };
}

function missing(field: string, reason: object) {
  return { field, status: "missing", reason };
}

// The a5 dictionary less its plot column, which never counts as a column to describe.
const UNDESCRIBED = ["relative_humidity", "quality_flag"];
const WITHOUT_TERM = ["light_intensity", "daily_mean_temperature", "daily_mean_light"];
const WITHOUT_ORCID = ["Alex Example", "Robin Example"];

const NO_LOCATION = { code: "no-location" };
const NOT_DESCRIBED = { code: "columns-not-described", subjects: UNDESCRIBED };
const NO_ORCID = { code: "members-without-orcid", subjects: WITHOUT_ORCID, includesViewer: false };

// Every field the package fills or leaves empty, so the empty ones are the 8 the export menu names.
const MIAPPE_FIELDS = {
  standard: "miappe",
  filled: 14,
  total: 22,
  validator: null,
  fields: [
    filled("title", "Drought trial (example data)", "experiment"),
    filled(
      "description",
      "Soybean lines under three irrigation treatments, measured weekly through the season.",
      "experiment",
    ),
    filled("license", "CC BY 4.0", "study-details"),
    filled("start-date", "4 May 2026", "study-details"),
    filled("end-date", "25 September 2026", "study-details"),
    filled(
      "experimental-design",
      "Randomized complete blocks, three treatments in three blocks",
      "study-details",
    ),
    filled("growth-facility", "Open field", "study-details"),
    filled("observation-unit-level", "Plot", "layout"),
    missing("site-name", NO_LOCATION),
    missing("country", NO_LOCATION),
    missing("latitude", NO_LOCATION),
    missing("longitude", NO_LOCATION),
    filled("person-name", "Seed User, Alex Example, Robin Example", "profile"),
    missing("orcid", NO_ORCID),
    filled("organism", "Glycine max", "study-details"),
    filled("biological-material-id", "Line A, Line B", "layout"),
    filled("experimental-factor", "Treatment: Control, Drought, Severe drought", "layout"),
    filled("observation-unit-id", "46 plots, A1 to F8", "layout"),
    filled("variable-name", "6 columns", "data-dictionary"),
    missing("trait", NOT_DESCRIBED),
    missing("method", NOT_DESCRIBED),
    missing("scale", NOT_DESCRIBED),
  ],
};

export const miappeFields = experimentRoute("/standards/miappe/fields", MIAPPE_FIELDS);
const noExports = experimentRoute("/data/exports", { exports: [] });

// The experiment chose the checklist and crop trait names. Four steps hold Freeze: three from
// those standards and plots D6 and D7, measured twice in d9, which hold every dataset. The ORCID step
// waits on two members and the skipped plots from e10 only inform.
const STANDARDS = {
  followed: ["miappe", "crop-ontology"],
  standards: [
    {
      standard: "miappe",
      state: "partial",
      filled: 14,
      total: 22,
      status: { code: "fields-missing", count: 8 },
    },
    {
      standard: "crop-ontology",
      state: "partial",
      filled: 1,
      total: 4,
      status: { code: "columns-without-term", count: 3 },
    },
    {
      standard: "common-greenhouse-ontology",
      state: "not-applicable",
      filled: null,
      total: null,
      status: { code: "applies-to-greenhouses" },
    },
    {
      standard: "openaire",
      state: "partial",
      filled: null,
      total: null,
      status: { code: "filled-while-publishing" },
    },
    {
      standard: "brapi",
      state: "met",
      filled: 4,
      total: 4,
      status: { code: "calls-answer", count: 4 },
    },
    {
      standard: "ogc-sensorthings",
      state: "not-applicable",
      filled: null,
      total: null,
      status: { code: "under-evaluation" },
    },
    {
      standard: "fair",
      state: "partial",
      filled: null,
      total: null,
      status: { code: "scored", percent: 71 },
    },
  ],
  steps: [
    { reason: NO_LOCATION, holdsFreeze: true, standards: ["miappe"] },
    { reason: NOT_DESCRIBED, holdsFreeze: true, standards: ["miappe"] },
    {
      reason: { code: "columns-without-term", subjects: WITHOUT_TERM },
      holdsFreeze: true,
      standards: ["crop-ontology"],
    },
    {
      reason: { code: "plots-measured-twice", subjects: ["D6", "D7"] },
      holdsFreeze: true,
      standards: [],
    },
    { reason: NO_ORCID, holdsFreeze: false, standards: ["miappe"] },
    {
      reason: { code: "plots-left-skipped", subjects: ["A4", "E4"] },
      holdsFreeze: false,
      standards: [],
    },
  ],
};

export const standards = experimentRoute("/standards", STANDARDS);

/** Saving a choice answers with what was sent, as the product does. */
const followedEcho: Fixture = {
  install: async (page) => {
    await page.route(
      (url) => url.pathname.endsWith("/standards/followed"),
      (route) => route.fulfill({ status: 200, json: route.request().postDataJSON() }),
    );
  },
};

// F's dataset fixtures are not exported, so the two versions from the example field are mirrored.
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
];

function exampleDataset(id: string, experiment: string, version: number, isDraft: boolean) {
  return {
    id,
    experimentId: experiment,
    version,
    state: isDraft ? "draft" : "published",
    title: "Drought trial, 2026 season (example data)",
    description:
      "Soybean lines under three irrigation treatments, measured weekly through the season.",
    limitations: null,
    authors: AUTHORS,
    license: isDraft ? null : "CC-BY-4.0",
    access: "open",
    embargoUntil: null,
    funding: [{ funderName: "Example Research Council", awardNumber: "EX-2026-001" }],
    relatedPublications: [],
    excludedReadings: [],
    studyDetails: null,
    readingCount: isDraft ? null : 920,
    plotCount: isDraft ? null : 46,
    doi: isDraft ? null : "10.5281/zenodo.0000000",
    deposit: null,
    supersedesId: null,
    files: [],
    createdAt: isDraft ? "2026-10-18T09:30:00.000Z" : "2026-09-28T09:00:00.000Z",
    publishedAt: isDraft ? null : "2026-09-30T10:00:00.000Z",
    withdrawnAt: null,
    withdrawalReason: null,
    zenodoCopy: null,
  };
}

const datasetList: Fixture = {
  install: async (page) => {
    const experiment = await resolve(DROUGHT_TRIAL);
    await page.route(
      (url) => url.pathname === `/api/v1/experiments/${experiment}/datasets`,
      (route) =>
        route.fulfill({
          status: 200,
          json: [
            exampleDataset("00000000-0000-4000-9000-000000000002", experiment, 2, true),
            exampleDataset("00000000-0000-4000-9000-000000000001", experiment, 1, false),
          ],
        }),
    );
  },
};

/** The seed links a wheat workbook the example field does not have, so the trial shows none. */
export const noLinkedWorkbook: Fixture = {
  install: async (page) => {
    await page.route(
      (url) => url.pathname.startsWith("/api/v1/workbooks/"),
      (route) => route.fulfill({ status: 404, json: { message: "Not found" } }),
    );
  },
};

export async function overviewRoute(): Promise<string> {
  return `/platform/experiments/${await resolve(DROUGHT_TRIAL)}`;
}

async function datasetsRoute(): Promise<string> {
  return `${await overviewRoute()}/datasets`;
}

/** Radix marks the page outside an open menu aria-hidden, so menu parts are found by CSS. */
function openMenu(page: Page) {
  return page.locator("[role='menu']");
}

/** Found by CSS, since an open dialog hides the page from role queries. */
function tabStrip(page: Page): Locator {
  return page.locator("[role='tablist']").first();
}

function detailsCard(page: Page): Locator {
  return page
    .locator("h3", { hasText: /^Details$/ })
    .locator("xpath=ancestor::div[contains(concat(' ', @class, ' '), ' rounded-xl ')][1]");
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

async function openExportMenu(page: Page): Promise<Locator> {
  await page.getByText("Line A").first().waitFor();
  await page.getByRole("button", { name: "Download table" }).first().click();

  const dialog = page.locator("[role='dialog']", { hasText: "Export table" });
  await dialog.getByRole("button", { name: "Create Export" }).click();
  await openMenu(page).getByText("8 fields will be empty").waitFor();
  await settled(openMenu(page));
  return dialog;
}

/** The Whole experiment group: its label and the package item under it. */
function packageGroup(page: Page): Locator[] {
  return [
    openMenu(page).getByText("Whole experiment", { exact: true }),
    openMenu(page).locator("[role='menuitem']", { hasText: "Plant phenotyping checklist" }),
  ];
}

const exportMiappe: TicketShot = {
  slug: "b5-export-miappe",
  route: async () => `${await overviewRoute()}/data`,
  fixtures: [trialTables, noExports, miappeFields],
  viewport: { width: 1440, height: 1100 },
  prepare: async (page) => {
    const dialog = await openExportMenu(page);

    const marker = new ChangeMarker(page);
    await marker.mark(packageGroup(page), "New", "outside-left");
    await marker.mark(dialog.locator("h2"), "New", "inside-right");
    return marker.frame([dialog, openMenu(page)], 24);
  },
};

const exportConfirm: TicketShot = {
  slug: "b5-export-confirm",
  route: async () => `${await overviewRoute()}/data`,
  fixtures: [trialTables, noExports, miappeFields],
  viewport: { width: 1440, height: 1300 },
  prepare: async (page) => {
    const dialog = await openExportMenu(page);
    await openMenu(page)
      .locator("[role='menuitem']", { hasText: "Plant phenotyping checklist" })
      .click();

    const confirm = dialog.getByTestId("miappe-export-confirm");
    await confirm.getByText("Export anyway").waitFor();
    await settled(dialog);
    await blurFocus(page);

    const marker = new ChangeMarker(page);
    await marker.mark(confirm, "New", "outside-left");
    return marker.frame([dialog], 24);
  },
};

/** The Datasets tab with the steps block and the dataset list loaded. */
async function waitForDatasets(page: Page): Promise<Locator> {
  const block = page.getByTestId("standards-steps");
  await block.getByText("Freeze waits for the 4 steps above").waitFor();
  await page.getByTestId("experiment-datasets").getByText("Version 1").waitFor();
  return block;
}

const standardsSteps: TicketShot = {
  slug: "b8-standards-steps",
  route: datasetsRoute,
  fixtures: [datasetList, standards, miappeFields],
  viewport: { width: 1440, height: 1500 },
  prepare: async (page) => {
    const block = await waitForDatasets(page);
    const list = page.getByTestId("experiment-datasets");

    const marker = new ChangeMarker(page);
    await marker.mark(block, "New", "above");
    return marker.frame([tabStrip(page), block, list], 24);
  },
};

const detailsLine: TicketShot = {
  slug: "b8-details-line",
  route: overviewRoute,
  fixtures: [trialTables, standards, noLinkedWorkbook],
  viewport: { width: 1440, height: 1500 },
  prepare: async (page) => {
    const line = page.getByTestId("standards-line");
    await line.getByText("4 steps before freezing.", { exact: false }).waitFor();
    await page.getByText("Glycine max").waitFor();

    const marker = new ChangeMarker(page);
    await marker.mark(line, "New", "outside-left");
    return marker.frame([tabStrip(page), detailsCard(page)], 24);
  },
};

const chooseStandards: TicketShot = {
  slug: "b8-choose",
  route: datasetsRoute,
  fixtures: [datasetList, standards, miappeFields, followedEcho],
  viewport: { width: 1440, height: 1500 },
  prepare: async (page) => {
    const block = await waitForDatasets(page);
    await block.getByRole("button", { name: "Change", exact: true }).click();

    const dialog = page.locator("[role='dialog']", { hasText: "What this experiment follows" });
    await dialog.getByText("Shown here, but not followed").waitFor();
    await settled(dialog);
    await blurFocus(page);

    const marker = new ChangeMarker(page);
    await marker.mark(dialog, "New", "above");
    return marker.frame([tabStrip(page), block, dialog], 24);
  },
};

const fieldPanel: TicketShot = {
  slug: "b9-field-panel",
  route: datasetsRoute,
  fixtures: [datasetList, standards, miappeFields],
  // As tall as the panel's content, since the sheet runs the viewport's full height.
  viewport: { width: 1440, height: 1000 },
  prepare: async (page) => {
    const block = await waitForDatasets(page);
    await block.getByRole("button", { name: /^Plant phenotyping checklist/ }).click();

    const sheet = page.locator("[role='dialog']", { hasText: "14 of 22 fields filled" });
    const fields = sheet.getByTestId("standard-fields");
    await fields.getByText("Still missing").waitFor();
    await settled(sheet);
    await blurFocus(page);

    // The sheet is flush with three viewport edges and its close button sits in the header, so the
    // outline goes round the field list.
    const marker = new ChangeMarker(page);
    await marker.mark(fields, "New", "outside-left");
    return marker.frame([tabStrip(page), block, sheet], 24);
  },
};

export const SHOTS_B: readonly TicketShot[] = [
  exportMiappe,
  exportConfirm,
  standardsSteps,
  detailsLine,
  chooseStandards,
  fieldPanel,
];
