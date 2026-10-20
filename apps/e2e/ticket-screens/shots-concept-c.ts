import type { Locator, Page } from "@playwright/test";

import type {
  ColumnDescription,
  ColumnDictionary,
  ColumnProducer,
  DictionaryColumn,
} from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import type { ExperimentTableMetadata } from "@repo/api/domains/experiment/data/experiment-data.schema";

import type { Box } from "./change-marker.js";
import { ChangeMarker } from "./change-marker.js";
import type { Fixture } from "./fixture.js";
import { resolve } from "./fixture.js";
import {
  DROUGHT_TRIAL,
  miappeFields,
  noLinkedWorkbook,
  overviewRoute,
  readiness,
  trialTables,
} from "./shots-b.js";
import type { TicketShot } from "./shots.js";

const TAG = "Concept C";

async function overviewWithConcept(): Promise<string> {
  return `${await overviewRoute()}?readiness=c`;
}

async function dataWithConcept(): Promise<string> {
  return `${await overviewRoute()}/data?readiness=c`;
}

/** Waits out an opening slide, which would otherwise skew the outline drawn around a part of it. */
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

/** Found by CSS, since an open sheet hides the page from role queries. */
function overviewTab(page: Page) {
  return page.locator("[role='tab']", { hasText: /^Overview$/ });
}

/** Ends a crop a little below the lowest element, so the next section is not cut through its middle. */
async function endBelow(crop: Box, elements: readonly Locator[], gap: number): Promise<Box> {
  const boxes = await Promise.all(elements.map((element) => element.boundingBox()));
  const bottoms = boxes.flatMap((box) => (box ? [box.y + box.height] : []));
  if (bottoms.length === 0) {
    throw new Error("None of the elements that end the crop is on the page");
  }
  return { ...crop, height: Math.max(...bottoms) + gap - crop.y };
}

function readinessStrip(page: Page) {
  return page.locator("#standards-readiness");
}

function detailsCard(page: Page) {
  return page
    .locator("h3", { hasText: /^Details$/ })
    .locator("xpath=ancestor::div[contains(concat(' ', @class, ' '), ' rounded-xl ')][1]");
}

function locationsSection(page: Page) {
  return page.locator("h4", { hasText: "Experiment Locations" }).locator("xpath=../..");
}

const MACRO_ID = "00000000-0000-4000-8000-0000000000a5";
const INSTRUMENT: ColumnProducer = { kind: "instrument", workbookVersion: 4 };
const DAILY_MEANS: ColumnProducer = { kind: "macro", macroId: MACRO_ID, macroName: "Daily means" };
const READING = "Sensor reading taken with each measurement";
const DAILY_MEAN = "Mean of one day's readings for one plot";
const CELSIUS = "Degrees Celsius";
const PHOTONS = "Micromoles of photons per square meter per second";

function described(trait: string, method: string, scale: string, unit: string): ColumnDescription {
  return { trait, traitTerm: null, method, methodTerm: null, scale, scaleTerm: null, unit };
}

function column(
  table: string,
  name: string,
  type: string,
  rowCount: number,
  description: ColumnDescription | null,
): DictionaryColumn {
  return { identity: `${table}:${name}`, name, type, rowCount, description };
}

// The a5 data dictionary, column for column: four of seven described, one with a Crop Ontology term.
const DICTIONARY: ColumnDictionary = {
  groups: [
    {
      producer: INSTRUMENT,
      columns: [
        column("raw_data", "leaf_temperature", "DOUBLE", 1240, {
          ...described("Leaf temperature", READING, CELSIUS, "°C"),
          traitTerm: { id: "CO_336:0000561", label: "Leaf temperature" },
        }),
        column(
          "raw_data",
          "light_intensity",
          "DOUBLE",
          1240,
          described("Light intensity", READING, PHOTONS, "µmol m⁻² s⁻¹"),
        ),
        column("raw_data", "relative_humidity", "DOUBLE", 1180, null),
        column("raw_data", "plot", "STRING", 1240, null),
      ],
    },
    {
      producer: DAILY_MEANS,
      columns: [
        column(
          MACRO_ID,
          "daily_mean_temperature",
          "DOUBLE",
          96,
          described("Daily mean leaf temperature", DAILY_MEAN, CELSIUS, "°C"),
        ),
        column(
          MACRO_ID,
          "daily_mean_light",
          "DOUBLE",
          96,
          described("Daily mean light intensity", DAILY_MEAN, PHOTONS, "µmol m⁻² s⁻¹"),
        ),
        column(MACRO_ID, "quality_flag", "STRING", 96, null),
      ],
    },
  ],
};

function tableMetadata(
  identifier: string,
  tableType: ExperimentTableMetadata["tableType"],
  displayName: string,
  totalRows: number,
): ExperimentTableMetadata {
  return {
    identifier,
    tableType,
    displayName,
    totalRows,
    latestRowAt: "2026-09-25T16:00:00.000Z",
    schemaRevision: "fixture",
  };
}

const TABLES: ExperimentTableMetadata[] = [
  tableMetadata("raw_data", "static", "Raw Data", 1240),
  tableMetadata(MACRO_ID, "macro", "Processed Data (Daily means)", 96),
];

/** The scaffold's dictionary route, which has no backend yet, and the tables with their types. */
const columnDictionary: Fixture = {
  install: async (page) => {
    const prefix = `/api/v1/experiments/${await resolve(DROUGHT_TRIAL)}`;
    const answers = new Map<string, unknown>([
      [`${prefix}/tables`, TABLES],
      [`${prefix}/columns`, DICTIONARY],
    ]);

    await page.route(
      (url) => answers.has(url.pathname),
      (route) =>
        route.fulfill({ status: 200, json: answers.get(new URL(route.request().url()).pathname) }),
    );
  },
};

const OVERVIEW_FIXTURES: readonly Fixture[] = [
  trialTables,
  readiness,
  miappeFields,
  noLinkedWorkbook,
];

async function overviewLoaded(page: Page): Promise<void> {
  await readinessStrip(page).getByText("See what is left").waitFor();
  await page.getByText("Glycine max").waitFor();
}

const overviewStrip: TicketShot = {
  slug: "b8-concept-c-overview",
  route: overviewWithConcept,
  fixtures: OVERVIEW_FIXTURES,
  viewport: { width: 1440, height: 1300 },
  prepare: async (page) => {
    await overviewLoaded(page);
    const strip = readinessStrip(page);

    const marker = new ChangeMarker(page);
    await marker.mark(strip, TAG, "above");
    const crop = await marker.frame([overviewTab(page), strip, detailsCard(page)], 24);
    return endBelow(crop, [strip], 24);
  },
};

const locationHint: TicketShot = {
  slug: "b8-concept-c-location",
  route: overviewWithConcept,
  fixtures: OVERVIEW_FIXTURES,
  viewport: { width: 1440, height: 1300 },
  prepare: async (page) => {
    await overviewLoaded(page);
    const section = locationsSection(page);
    const hint = section.getByRole("status");
    await hint.getByText("ask where a trial ran").waitFor();

    const marker = new ChangeMarker(page);
    await marker.mark(hint, TAG, "outside-left");
    // The gap to the next section is 16px, so a smaller margin keeps its heading out.
    const crop = await marker.frame([overviewTab(page), section, detailsCard(page)], 24);
    return endBelow(crop, [section], 10);
  },
};

const dictionaryChips: TicketShot = {
  slug: "b8-concept-c-dictionary",
  route: dataWithConcept,
  fixtures: [trialTables, columnDictionary, readiness, miappeFields],
  viewport: { width: 1440, height: 1100 },
  prepare: async (page) => {
    const viewSwitch = page.getByRole("tablist", { name: "Data view" });
    await viewSwitch.waitFor();
    await viewSwitch.getByRole("tab", { name: "Dictionary" }).click();
    const count = page.getByText("4 of 7 columns described");
    await count.waitFor();

    const chips = page.getByText("Repositories need this");
    await chips.nth(2).waitFor();
    const traitCell = (index: number) => chips.nth(index).locator("xpath=ancestor::td");

    const marker = new ChangeMarker(page);
    await marker.mark([traitCell(0), traitCell(1)], TAG, "inside-right");
    await marker.mark(traitCell(2), TAG, "inside-right");

    const dataTab = page.getByRole("tab", { name: "Data", exact: true });
    return marker.frame([dataTab, viewSwitch, count.locator("xpath=..")], 24);
  },
};

const stepsSheet: TicketShot = {
  slug: "b8-concept-c-sheet",
  route: overviewWithConcept,
  fixtures: OVERVIEW_FIXTURES,
  viewport: { width: 1440, height: 1300 },
  prepare: async (page) => {
    await overviewLoaded(page);
    const strip = readinessStrip(page);
    await strip.getByRole("button", { name: "See what is left" }).click();

    const sheet = page.locator("[role='dialog']", { hasText: "What is left" });
    await sheet.getByText("Publish a dataset").waitFor();
    await settled(sheet);
    await blurFocus(page);
    const steps = sheet.locator("ol");

    const marker = new ChangeMarker(page);
    await marker.mark(steps, TAG, "below");
    // Room for the tag under the steps.
    const crop = await marker.frame([overviewTab(page), strip, sheet], 32);
    return endBelow(crop, [strip, steps], 56);
  },
};

export const SHOTS_CONCEPT_C: readonly TicketShot[] = [
  overviewStrip,
  locationHint,
  dictionaryChips,
  stepsSheet,
];
