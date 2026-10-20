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

function filled(section: string, field: string, value: string, source: FieldSource) {
  return { section, field, status: "filled", value, source };
}

function missing(section: string, field: string, reason: object, fix: string) {
  return { section, field, status: "missing", reason, fix };
}

const NO_LOCATION = { code: "no-location" };
const UNDESCRIBED = { code: "columns-not-described", count: 3 };

// Every field the export fills or leaves empty, so the missing ones are the 8 the menu item implies.
const MIAPPE_FIELDS = {
  standard: "miappe",
  filled: 14,
  total: 22,
  fields: [
    filled("investigation", "title", "Drought trial (example data)", "experiment"),
    filled(
      "investigation",
      "description",
      "Soybean lines under three irrigation treatments, measured weekly through the season.",
      "experiment",
    ),
    filled("investigation", "license", "CC BY 4.0", "study-details"),
    filled("study", "start-date", "4 May 2026", "study-details"),
    filled("study", "end-date", "25 September 2026", "study-details"),
    filled(
      "study",
      "experimental-design",
      "Randomized complete blocks, three treatments in three blocks",
      "study-details",
    ),
    filled("study", "growth-facility", "Open field", "study-details"),
    filled("study", "observation-unit-level", "Plot", "layout"),
    missing("study", "site-name", NO_LOCATION, "add-location"),
    missing("study", "country", NO_LOCATION, "add-location"),
    missing("study", "latitude", NO_LOCATION, "add-location"),
    missing("study", "longitude", NO_LOCATION, "add-location"),
    filled("people", "person-name", "Seed User, Alex Example, Robin Example", "profile"),
    missing("people", "orcid", { code: "authors-without-orcid", count: 2 }, "connect-orcid"),
    filled("biological-material", "organism", "Glycine max", "study-details"),
    filled("biological-material", "biological-material-id", "Line A, Line B", "layout"),
    filled(
      "experimental-factors",
      "experimental-factor",
      "Treatment: Control, Drought, Severe drought",
      "layout",
    ),
    filled("observation-units", "observation-unit-id", "46 plots, A1 to F8", "layout"),
    filled("observed-variables", "variable-name", "7 columns", "data-dictionary"),
    missing("observed-variables", "trait", UNDESCRIBED, "describe-columns"),
    missing("observed-variables", "method", UNDESCRIBED, "describe-columns"),
    missing("observed-variables", "scale", UNDESCRIBED, "describe-columns"),
  ],
};

export const miappeFields = experimentRoute("/standards/miappe/fields", MIAPPE_FIELDS);
const noExports = experimentRoute("/data/exports", { exports: [] });

/** The seed links a wheat workbook the example field does not have, so the trial shows none. */
export const noLinkedWorkbook: Fixture = {
  install: async (page) => {
    await page.route(
      (url) => url.pathname.startsWith("/api/v1/workbooks/"),
      (route) => route.fulfill({ status: 404, json: { message: "Not found" } }),
    );
  },
};

/** Radix marks the page outside an open menu aria-hidden, so menu parts are found by CSS. */
function openMenu(page: Page) {
  return page.locator("[role='menu']");
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

const exportMiappe: TicketShot = {
  slug: "b5-export-miappe",
  route: async () => `/platform/experiments/${await resolve(DROUGHT_TRIAL)}/data`,
  fixtures: [trialTables, noExports, miappeFields],
  viewport: { width: 1440, height: 1000 },
  prepare: async (page) => {
    await page.getByText("Line A").first().waitFor();
    await page.getByRole("button", { name: "Download table" }).first().click();

    const dialog = page.locator("[role='dialog']", { hasText: "Export Dataset" });
    await dialog.getByRole("button", { name: "Create Export" }).click();
    const miappe = openMenu(page).locator("[role='menuitem']", { hasText: "MIAPPE (ISA-Tab)" });
    await miappe.getByText("14 of 22 fields can be filled").waitFor();
    await settled(openMenu(page));

    const marker = new ChangeMarker(page);
    await marker.mark(miappe, "New", "outside-left");
    return marker.frame([dialog, openMenu(page)], 24);
  },
};

const READINESS = {
  standards: [
    {
      standard: "fair",
      state: "not-assessed",
      filled: null,
      total: null,
      reason: { code: "no-published-dataset" },
    },
    {
      standard: "crop-ontology",
      state: "partial",
      filled: 1,
      total: 4,
      reason: { code: "columns-without-term", count: 3 },
    },
    {
      standard: "common-greenhouse-ontology",
      state: "not-applicable",
      filled: null,
      total: null,
      reason: { code: "unit-without-greenhouse-term", unitName: "Plot" },
    },
    {
      standard: "miappe",
      state: "partial",
      filled: 14,
      total: 22,
      reason: { code: "fields-not-fillable", count: 8 },
    },
    {
      standard: "brapi",
      state: "met",
      filled: 4,
      total: 4,
      reason: { code: "calls-pass", count: 4 },
    },
    {
      standard: "ogc-sensorthings",
      state: "not-applicable",
      filled: null,
      total: null,
      reason: { code: "under-evaluation" },
    },
    {
      standard: "openaire-floor",
      state: "partial",
      filled: 2,
      total: 8,
      reason: { code: "fields-from-dataset", count: 6 },
    },
  ],
};

export const readiness = experimentRoute("/standards", READINESS);

export async function overviewRoute(): Promise<string> {
  return `/platform/experiments/${await resolve(DROUGHT_TRIAL)}`;
}

function readinessSection(page: Page) {
  return page.locator("#standards-readiness");
}

/**
 * Centres the readiness section so the data inventory above it clears the sticky header, and
 * returns the inventory heading that opens the crop. Found by CSS, since an open sheet hides the
 * page from role queries.
 */
async function scrollToInventory(page: Page) {
  await readinessSection(page).evaluate((element) => element.scrollIntoView({ block: "center" }));
  return page.locator("h2", { hasText: /^Data$/ });
}

const readinessScreen: TicketShot = {
  slug: "b8-readiness",
  route: overviewRoute,
  fixtures: [trialTables, readiness, miappeFields],
  viewport: { width: 1440, height: 1240 },
  prepare: async (page) => {
    const section = readinessSection(page);
    await section.getByText("OpenAIRE floor").waitFor();
    await page.getByText("Glycine max").waitFor();
    const inventory = await scrollToInventory(page);

    const marker = new ChangeMarker(page);
    await marker.mark(section, "New", "above");
    return marker.frame([inventory, section], 36);
  },
};

const fieldPanel: TicketShot = {
  slug: "b9-field-panel",
  route: overviewRoute,
  fixtures: [trialTables, readiness, miappeFields, noLinkedWorkbook],
  // Tall enough for all 22 fields unscrolled, so the panel's counts can be checked against its rows.
  viewport: { width: 1440, height: 1760 },
  prepare: async (page) => {
    const section = readinessSection(page);
    await section.getByText("OpenAIRE floor").waitFor();
    await page.getByText("Glycine max").waitFor();
    const inventory = await scrollToInventory(page);
    await section.getByRole("button", { name: /^MIAPPE/ }).click();

    const sheet = page.locator("[role='dialog']", { hasText: "14 of 22 fields filled" });
    await sheet.getByText("Describe columns").first().waitFor();
    await settled(sheet);
    await blurFocus(page);

    // The sheet is flush with three viewport edges and its close button sits in the header, so the
    // outline goes round the field list.
    const sections = sheet.locator("section");

    const marker = new ChangeMarker(page);
    await marker.mark([sections.first(), sections.last()], "New", "below");
    return marker.frame([inventory, section, sheet], 24);
  },
};

export const SHOTS_B: readonly TicketShot[] = [exportMiappe, readinessScreen, fieldPanel];
