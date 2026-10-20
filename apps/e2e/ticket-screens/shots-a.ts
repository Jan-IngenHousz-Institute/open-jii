import type { Page } from "@playwright/test";

import type {
  ColumnDescription,
  ColumnDictionary,
  ColumnProducer,
  ColumnSuggestion,
  ColumnTerm,
  DictionaryColumn,
} from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import type { ExperimentTableMetadata } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { experimentId } from "../docs-media/seed-entities.js";
import { examplePlots } from "./example-field.js";
import { ChangeMarker } from "./change-marker.js";
import type { FixtureRow, FixtureTable } from "./fixture-tables.js";
import { FixtureWarehouse } from "./fixture-warehouse.js";
import type { Fixture, Resolvable } from "./fixture.js";
import { resolve } from "./fixture.js";
import type { TicketShot } from "./shots.js";

const DROUGHT_TRIAL: Resolvable = () => experimentId("Drought trial (example data)");

async function overviewRoute(): Promise<string> {
  return `/platform/experiments/${await resolve(DROUGHT_TRIAL)}`;
}

async function dataRoute(): Promise<string> {
  return `/platform/experiments/${await resolve(DROUGHT_TRIAL)}/data`;
}

function studySection(page: Page) {
  return page.getByRole("heading", { name: "Study details", exact: true }).locator("xpath=../..");
}

async function blurFocus(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
}

const funding: TicketShot = {
  slug: "a2-funding",
  route: overviewRoute,
  prepare: async (page) => {
    await page.getByText("Glycine max").waitFor();
    await studySection(page).getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();

    const section = dialog.getByRole("region", { name: "Funding" });
    await section.getByRole("button", { name: "Add funding" }).click();
    await section.getByLabel("Funder").fill("Example Research Council");
    await section.getByLabel("Grant or award number").fill("EX-2026-001");
    await blurFocus(page);
    await dialog.getByRole("button", { name: "Save" }).scrollIntoViewIfNeeded();

    const marker = new ChangeMarker(page);
    await marker.mark(section, "New", "below");
    return marker.frame([dialog], 16);
  },
};

const MACRO_ID = "00000000-0000-4000-8000-0000000000a5";
const INSTRUMENT_ROWS = 1240;
const MACRO_ROWS = 96;

const INSTRUMENT: ColumnProducer = { kind: "instrument", workbookVersion: 4 };
const DAILY_MEANS: ColumnProducer = { kind: "macro", macroId: MACRO_ID, macroName: "Daily means" };

function described(
  trait: string,
  traitTerm: ColumnTerm | null,
  method: string,
  scale: string,
  unit: string | null,
): ColumnDescription {
  return { trait, traitTerm, method, methodTerm: null, scale, scaleTerm: null, unit };
}

interface ExampleColumn {
  name: string;
  type: "DOUBLE" | "STRING";
  description: ColumnDescription | null;
}

const READING = "Sensor reading taken with each measurement";

const INSTRUMENT_COLUMNS: readonly ExampleColumn[] = [
  {
    name: "leaf_temperature",
    type: "DOUBLE",
    description: described(
      "Leaf temperature",
      { id: "CO_336:0000561", label: "Leaf temperature" },
      READING,
      "Degrees Celsius",
      "°C",
    ),
  },
  {
    name: "light_intensity",
    type: "DOUBLE",
    description: described(
      "Light intensity",
      null,
      READING,
      "Micromoles of photons per square meter per second",
      "µmol m⁻² s⁻¹",
    ),
  },
  { name: "relative_humidity", type: "DOUBLE", description: null },
  { name: "plot", type: "STRING", description: null },
];

const MACRO_COLUMNS: readonly ExampleColumn[] = [
  {
    name: "daily_mean_temperature",
    type: "DOUBLE",
    description: described(
      "Daily mean leaf temperature",
      null,
      "Mean of one day's readings for one plot",
      "Degrees Celsius",
      "°C",
    ),
  },
  {
    name: "daily_mean_light",
    type: "DOUBLE",
    description: described(
      "Daily mean light intensity",
      null,
      "Mean of one day's readings for one plot",
      "Micromoles of photons per square meter per second",
      "µmol m⁻² s⁻¹",
    ),
  },
  { name: "quality_flag", type: "STRING", description: null },
];

const HUMIDITY_TERMS: readonly ColumnTerm[] = [
  { id: "CO_336:0000301", label: "Air relative humidity" },
  { id: "CO_336:0000302", label: "Canopy relative humidity" },
  { id: "CO_336:0000303", label: "Relative humidity at sowing" },
];

const QUALITY_SUGGESTION: ColumnSuggestion = {
  description: {
    trait: "Measurement quality",
    traitTerm: null,
    method: "Automatic check of each day's readings",
    methodTerm: null,
    scale: "Pass or fail",
    scaleTerm: null,
    unit: null,
  },
  experimentCount: 3,
};

function instrumentRows(): FixtureRow[] {
  const plots = examplePlots();
  return Array.from({ length: INSTRUMENT_ROWS }, (_, index) => {
    const isHumidityMissing = index % 20 === 0 && index < 1200;
    return {
      plot: plots[index % plots.length].identifier,
      leaf_temperature: Number((24 + ((index * 7) % 60) / 10).toFixed(1)),
      light_intensity: 400 + ((index * 37) % 900),
      relative_humidity: isHumidityMissing ? null : 40 + ((index * 13) % 40),
    };
  });
}

function macroRows(): FixtureRow[] {
  return Array.from({ length: MACRO_ROWS }, (_, index) => ({
    daily_mean_temperature: Number((25 + ((index * 3) % 40) / 10).toFixed(1)),
    daily_mean_light: 650 + ((index * 29) % 300),
    quality_flag: index % 9 === 4 ? "fail" : "pass",
  }));
}

function fixtureTable(
  identifier: string,
  displayName: string,
  columns: readonly ExampleColumn[],
  rows: FixtureRow[],
): FixtureTable {
  return {
    identifier,
    displayName,
    columns: columns.map(({ name, type }) => ({ name, type_name: type, type_text: type })),
    rows,
  };
}

const INSTRUMENT_TABLE = fixtureTable("raw_data", "Raw Data", INSTRUMENT_COLUMNS, instrumentRows());
const MACRO_TABLE = fixtureTable(
  MACRO_ID,
  "Processed Data (Daily means)",
  MACRO_COLUMNS,
  macroRows(),
);

/**
 * The drought trial's columns from one instrument workbook and one macro. Answers the tables list
 * with the right table types and the scaffold's dictionary, term search and suggestion routes,
 * which have no backend yet.
 */
class ExampleColumnDictionary implements Fixture {
  async install(page: Page): Promise<void> {
    const prefix = `/api/v1/experiments/${await resolve(DROUGHT_TRIAL)}`;
    const answers = new Map<string, (url: URL) => unknown>([
      [`${prefix}/tables`, () => this.tables()],
      [`${prefix}/columns`, () => this.dictionary()],
      [`${prefix}/columns/suggestion`, (url) => this.suggestion(url)],
      ["/api/v1/column-terms/search", () => ({ terms: HUMIDITY_TERMS })],
    ]);

    await page.route(
      (url) => answers.has(url.pathname),
      async (route) => {
        const url = new URL(route.request().url());
        const answer = answers.get(url.pathname);
        await route.fulfill({ status: 200, json: answer ? answer(url) : null });
      },
    );
  }

  private tables(): ExperimentTableMetadata[] {
    return [
      this.metadata(INSTRUMENT_TABLE, "static"),
      this.metadata(MACRO_TABLE, "macro"),
    ];
  }

  private metadata(
    table: FixtureTable,
    tableType: ExperimentTableMetadata["tableType"],
  ): ExperimentTableMetadata {
    return {
      identifier: table.identifier,
      tableType,
      displayName: table.displayName,
      totalRows: table.rows.length,
      latestRowAt: "2026-09-25T16:00:00.000Z",
      schemaRevision: "fixture",
    };
  }

  private dictionary(): ColumnDictionary {
    return {
      groups: [
        { producer: INSTRUMENT, columns: this.columns(INSTRUMENT_TABLE, INSTRUMENT_COLUMNS) },
        { producer: DAILY_MEANS, columns: this.columns(MACRO_TABLE, MACRO_COLUMNS) },
      ],
    };
  }

  private columns(table: FixtureTable, columns: readonly ExampleColumn[]): DictionaryColumn[] {
    return columns.map(({ name, type, description }) => ({
      identity: `${table.identifier}:${name}`,
      name,
      type,
      rowCount: table.rows.filter((row) => (row[name] ?? null) !== null).length,
      description,
    }));
  }

  private suggestion(url: URL): ColumnSuggestion | null {
    const isQualityFlag = url.searchParams.get("column") === `${MACRO_ID}:quality_flag`;
    return isQualityFlag ? QUALITY_SUGGESTION : null;
  }
}

const COLUMN_FIXTURES: readonly Fixture[] = [
  new FixtureWarehouse(DROUGHT_TRIAL, [INSTRUMENT_TABLE, MACRO_TABLE]),
  new ExampleColumnDictionary(),
];

async function openDictionary(page: Page): Promise<void> {
  const viewSwitch = page.getByRole("tablist", { name: "Data view" });
  await viewSwitch.waitFor();
  await viewSwitch.getByRole("tab", { name: "Dictionary" }).click();
  await page.getByText("4 of 7 columns described").waitFor();
}

const dataDictionary: TicketShot = {
  slug: "a5-data-dictionary",
  route: dataRoute,
  fixtures: COLUMN_FIXTURES,
  viewport: { width: 1440, height: 1100 },
  prepare: async (page) => {
    await openDictionary(page);
    const viewSwitch = page.getByRole("tablist", { name: "Data view" });
    const list = page.getByText("4 of 7 columns described").locator("xpath=..");
    const dataTab = page.getByRole("tab", { name: "Data", exact: true });

    const marker = new ChangeMarker(page);
    await marker.mark([viewSwitch, list], "New", "above");
    return marker.frame([dataTab, viewSwitch, list], 24);
  },
};

async function openColumn(page: Page, name: string) {
  await openDictionary(page);
  await page.getByRole("button", { name, exact: true }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("heading", { name, exact: true }).waitFor();
  return drawer;
}

const describeDrawer: TicketShot = {
  slug: "a6-describe-drawer",
  route: dataRoute,
  fixtures: COLUMN_FIXTURES,
  viewport: { width: 1440, height: 1000 },
  prepare: async (page) => {
    const drawer = await openColumn(page, "relative_humidity");
    await drawer.getByLabel("Trait", { exact: true }).fill("Relative humidity of the air");
    await drawer
      .getByLabel("Method", { exact: true })
      .fill("Sensor reading taken with each measurement");
    await drawer.getByLabel("Scale", { exact: true }).fill("Percent");
    await drawer.getByLabel("Unit", { exact: true }).fill("%");
    await drawer.getByRole("button", { name: "Add a Crop Ontology term (optional)" }).first().click();
    await drawer.getByPlaceholder("Search terms by name").fill("humidity");
    await drawer.getByText("CO_336:0000303").waitFor();

    const marker = new ChangeMarker(page);
    await marker.mark(drawer, "New", "outside-left");
    return undefined;
  },
};

const suggestion: TicketShot = {
  slug: "a7-suggestion",
  route: dataRoute,
  fixtures: COLUMN_FIXTURES,
  viewport: { width: 1440, height: 820 },
  prepare: async (page) => {
    const drawer = await openColumn(page, "quality_flag");
    const banner = drawer.getByRole("status").filter({ hasText: "Suggested from other experiments" });
    await banner.getByText("Used by 3 other experiments").waitFor();
    await blurFocus(page);

    const marker = new ChangeMarker(page);
    await marker.mark(banner, "New", "inside-right");
    return marker.frame([drawer], 0);
  },
};

export const SHOTS_A: readonly TicketShot[] = [funding, dataDictionary, describeDrawer, suggestion];
