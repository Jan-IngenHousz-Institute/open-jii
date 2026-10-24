import type { Locator, Page } from "@playwright/test";

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
import { ChangeMarker } from "./change-marker.js";
import { examplePlots } from "./example-field.js";
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
  viewport: { width: 1440, height: 1000 },
  prepare: async (page) => {
    await page.getByText("Glycine max").waitFor();
    await page.waitForLoadState("networkidle");
    await studySection(page).getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();

    const section = dialog.getByRole("region", { name: "Funding" });
    await section.getByRole("button", { name: "Add funding" }).click();
    await section.getByLabel("Funder").fill("Example Research Council");
    await section.getByLabel("Grant or award number").fill("EX-2026-001");
    await blurFocus(page);
    await section.scrollIntoViewIfNeeded();

    const marker = new ChangeMarker(page);
    await marker.mark(section, "New", "inside-top-right");
    return marker.frame([dialog], 16);
  },
};

const MACRO_ID = "00000000-0000-4000-8000-0000000000a5";
const WORKBOOK_NAME = "Field readings";

const WORKBOOK_4: ColumnProducer = {
  kind: "instrument",
  workbookVersion: 4,
  workbookName: WORKBOOK_NAME,
};
const WORKBOOK_5: ColumnProducer = {
  kind: "instrument",
  workbookVersion: 5,
  workbookName: WORKBOOK_NAME,
};
const DAILY_MEANS: ColumnProducer = { kind: "macro", macroId: MACRO_ID, macroName: "Daily means" };
const FROM_LAYOUT: ColumnProducer = { kind: "layout" };

const READING = "Sensor reading taken with each measurement";
const MEASURED_NUMBER = "Measured number";
const DAILY_MEAN = "Mean of one day's readings for one plot";

function described(
  trait: string,
  traitTerm: ColumnTerm | null,
  method: string,
  scale: string,
  unit: string | null,
  noTermFits = false,
): ColumnDescription {
  return {
    trait,
    traitTerm,
    noTermFits,
    method,
    methodTerm: null,
    scale,
    scaleTerm: null,
    unit,
  };
}

const LEAF_TEMPERATURE = described(
  "Leaf temperature",
  { id: "CO_336:0000561", label: "Leaf temperature" },
  READING,
  MEASURED_NUMBER,
  "°C",
);
const LIGHT_INTENSITY = described(
  "Light intensity",
  null,
  READING,
  MEASURED_NUMBER,
  "µmol m⁻² s⁻¹",
  true,
);

interface ExampleColumn {
  name: string;
  type: "DOUBLE" | "STRING";
  rowCount: number;
  description: ColumnDescription | null;
}

/** The same three readings under two workbook versions, so the counts split between them. */
function workbookReadings(rowCounts: readonly [number, number, number]): ExampleColumn[] {
  return [
    { name: "leaf_temperature", type: "DOUBLE", rowCount: rowCounts[0], description: null },
    { name: "light_intensity", type: "DOUBLE", rowCount: rowCounts[1], description: null },
    { name: "relative_humidity", type: "DOUBLE", rowCount: rowCounts[2], description: null },
  ];
}

const DESCRIBED_AT_VERSION_4: Record<string, ColumnDescription> = {
  leaf_temperature: LEAF_TEMPERATURE,
  light_intensity: LIGHT_INTENSITY,
};

const MACRO_COLUMNS: readonly ExampleColumn[] = [
  {
    name: "daily_mean_temperature",
    type: "DOUBLE",
    rowCount: 96,
    description: described(
      "Daily mean leaf temperature",
      null,
      DAILY_MEAN,
      MEASURED_NUMBER,
      "°C",
      true,
    ),
  },
  {
    name: "daily_mean_light",
    type: "DOUBLE",
    rowCount: 96,
    description: described(
      "Daily mean light intensity",
      null,
      DAILY_MEAN,
      MEASURED_NUMBER,
      "µmol m⁻² s⁻¹",
      true,
    ),
  },
  { name: "quality_flag", type: "STRING", rowCount: 96, description: null },
];

const HUMIDITY_TERMS: readonly ColumnTerm[] = [
  {
    id: "CO_336:0000301",
    label: "Air relative humidity",
    definition: "How much water vapor the air holds, as a percentage of the most it could hold.",
  },
  {
    id: "CO_336:0000302",
    label: "Canopy relative humidity",
    definition: "Relative humidity measured inside the plant canopy rather than above it.",
  },
  {
    id: "CO_336:0000303",
    label: "Relative humidity at sowing",
    definition: "Relative humidity of the air on the day the seeds were sown.",
  },
];

const QUALITY_SUGGESTION: ColumnSuggestion = {
  description: {
    trait: "Measurement quality",
    traitTerm: null,
    noTermFits: true,
    method: "Automatic check of each day's readings",
    methodTerm: null,
    scale: "Pass or fail",
    scaleTerm: null,
    unit: null,
  },
  experimentCount: 3,
};

const HUMIDITY_SUGGESTION: ColumnSuggestion = {
  description: {
    trait: "Relative humidity of the air",
    traitTerm: HUMIDITY_TERMS[0],
    noTermFits: false,
    method: READING,
    methodTerm: null,
    scale: MEASURED_NUMBER,
    scaleTerm: null,
    unit: "%",
  },
  experimentCount: 5,
};

const INSTRUMENT_ROWS = 1240;

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
  return Array.from({ length: 96 }, (_, index) => ({
    daily_mean_temperature: Number((25 + ((index * 3) % 40) / 10).toFixed(1)),
    daily_mean_light: 650 + ((index * 29) % 300),
    quality_flag: index % 9 === 4 ? "fail" : "pass",
  }));
}

function fixtureTable(
  identifier: string,
  displayName: string,
  columns: readonly { name: string; type: string }[],
  rows: FixtureRow[],
): FixtureTable {
  return {
    identifier,
    displayName,
    columns: columns.map(({ name, type }) => ({ name, type_name: type, type_text: type })),
    rows,
  };
}

const INSTRUMENT_TABLE = fixtureTable(
  "raw_data",
  "Raw Data",
  [
    { name: "plot", type: "STRING" },
    { name: "leaf_temperature", type: "DOUBLE" },
    { name: "light_intensity", type: "DOUBLE" },
    { name: "relative_humidity", type: "DOUBLE" },
  ],
  instrumentRows(),
);
const MACRO_TABLE = fixtureTable(
  MACRO_ID,
  "Processed Data (Daily means)",
  MACRO_COLUMNS,
  macroRows(),
);

interface DictionaryState {
  /** Another experiment or an earlier workbook version described the column, so it reads Suggested. */
  hasSuggestions?: boolean;
  /** Workbook version 5 exists beside version 4 and its columns point back at version 4's. */
  hasNewVersion?: boolean;
  /** The columns request fails, so the view shows its error. */
  isFailing?: boolean;
}

/**
 * The drought trial's columns from one workbook, one macro and the layout. Answers the tables list
 * with the right table types and the scaffold's dictionary, term search and suggestion routes,
 * which have no backend yet.
 */
class ExampleColumnDictionary implements Fixture {
  constructor(private readonly state: DictionaryState = {}) {}

  async install(page: Page): Promise<void> {
    const prefix = `/api/v1/experiments/${await resolve(DROUGHT_TRIAL)}`;
    const answers = new Map<string, (url: URL) => unknown>([
      [`${prefix}/tables`, () => this.tables()],
      [`${prefix}/columns`, () => this.dictionary()],
      [`${prefix}/columns/suggestion`, (url) => this.suggestion(url)],
      ["/api/v1/column-terms/search", () => ({ terms: HUMIDITY_TERMS })],
    ]);
    const failing = `${prefix}/columns`;

    await page.route(
      (url) => answers.has(url.pathname),
      async (route) => {
        const url = new URL(route.request().url());
        if (this.state.isFailing && url.pathname === failing) {
          await route.fulfill({ status: 500, json: { message: "The warehouse did not answer." } });
          return;
        }
        const answer = answers.get(url.pathname);
        await route.fulfill({ status: 200, json: answer ? answer(url) : null });
      },
    );
  }

  private tables(): ExperimentTableMetadata[] {
    return [this.metadata(INSTRUMENT_TABLE, "static"), this.metadata(MACRO_TABLE, "macro")];
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
    const { hasNewVersion } = this.state;
    const version4 = this.workbookColumns(
      "workbook-4",
      hasNewVersion ? [840, 840, 790] : [1240, 1240, 1180],
    );
    const groups: ColumnDictionary["groups"] = [];

    if (hasNewVersion) {
      const version5 = this.workbookColumns("workbook-5", [400, 400, 390], "workbook-4");
      groups.push({ producer: WORKBOOK_5, columns: version5 });
    }
    groups.push({ producer: WORKBOOK_4, columns: version4 });
    groups.push({ producer: DAILY_MEANS, columns: this.macroColumns() });
    groups.push({
      producer: FROM_LAYOUT,
      columns: [
        {
          identity: "layout:plot",
          name: "plot",
          type: "STRING",
          rowCount: INSTRUMENT_ROWS,
          description: null,
        },
      ],
    });

    return { groups };
  }

  private workbookColumns(
    producerKey: string,
    rowCounts: readonly [number, number, number],
    previousKey?: string,
  ): DictionaryColumn[] {
    const isOldVersion = producerKey === "workbook-4";

    return workbookReadings(rowCounts).map(({ name, type, rowCount }) => ({
      identity: `${producerKey}:${name}`,
      name,
      type,
      rowCount,
      description: isOldVersion ? (DESCRIBED_AT_VERSION_4[name] ?? null) : null,
      previous: previousKey ? `${previousKey}:${name}` : null,
      isSuggested: this.isSuggested(name, isOldVersion),
    }));
  }

  private macroColumns(): DictionaryColumn[] {
    return MACRO_COLUMNS.map(({ name, type, rowCount, description }) => ({
      identity: `${MACRO_ID}:${name}`,
      name,
      type,
      rowCount,
      description,
      previous: null,
      isSuggested: this.state.hasSuggestions === true && name === "quality_flag",
    }));
  }

  private isSuggested(name: string, isOldVersion: boolean): boolean {
    return this.state.hasSuggestions === true && isOldVersion && name === "relative_humidity";
  }

  private suggestion(url: URL): ColumnSuggestion | null {
    if (this.state.hasSuggestions !== true) {
      return null;
    }
    const column = url.searchParams.get("column");
    if (column === `${MACRO_ID}:quality_flag`) {
      return QUALITY_SUGGESTION;
    }
    return column === "workbook-4:relative_humidity" ? HUMIDITY_SUGGESTION : null;
  }
}

function warehouse(): Fixture {
  return new FixtureWarehouse(DROUGHT_TRIAL, [INSTRUMENT_TABLE, MACRO_TABLE]);
}

function dictionaryFixtures(state: DictionaryState = {}): readonly Fixture[] {
  return [warehouse(), new ExampleColumnDictionary(state)];
}

async function openDictionary(page: Page, countText: string): Promise<void> {
  const viewSwitch = page.getByRole("tablist", { name: "Data view" });
  await viewSwitch.waitFor();
  await viewSwitch.getByRole("tab", { name: "Dictionary" }).click();
  await page.getByText(countText).waitFor();
}

function dictionaryRoot(page: Page): Locator {
  return page
    .getByText("Every column this experiment has recorded")
    .locator("xpath=ancestor::div[contains(@class,'space-y-6')][1]");
}

async function openColumn(page: Page, accessibleName: string, countText: string) {
  await openDictionary(page, countText);
  await page.getByRole("button", { name: accessibleName, exact: true }).click();
  const drawer = page.getByRole("dialog");
  await drawer.waitFor();
  return drawer;
}

async function markDrawer(page: Page, drawer: Locator) {
  const marker = new ChangeMarker(page);
  await marker.mark(drawer, "New", "outside-left");
  return marker;
}

/** The Describe buttons and the filter are A6's and A8's changes, so A5's screen leaves them out. */
async function hideLaterChanges(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll("table tr").forEach((row) => row.lastElementChild?.remove());
    document.querySelector('[role="combobox"][aria-label="Show"]')?.remove();
  });
}

/** Save and next and the filter are A8's changes, so A6's screens leave them out. */
async function hideWalkThrough(page: Page): Promise<void> {
  await page.evaluate(() => {
    const saveAndNext = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent === "Save and next",
    );
    saveAndNext?.remove();
    document.querySelector('[role="combobox"][aria-label="Show"]')?.remove();
  });
}

const dataDictionary: TicketShot = {
  slug: "a5-data-dictionary",
  route: dataRoute,
  fixtures: dictionaryFixtures(),
  viewport: { width: 1440, height: 1260 },
  prepare: async (page) => {
    await openDictionary(page, "4 of 6 columns described");
    await hideLaterChanges(page);
    const viewSwitch = page.getByRole("tablist", { name: "Data view" });
    const root = dictionaryRoot(page);
    const dataTab = page.getByRole("tab", { name: "Data", exact: true });

    const marker = new ChangeMarker(page);
    await marker.mark([viewSwitch, root], "New", "above");
    return marker.frame([dataTab, viewSwitch, root], 24);
  },
};

const dictionaryFailed: TicketShot = {
  slug: "a5-dictionary-failed",
  route: dataRoute,
  fixtures: dictionaryFixtures({ isFailing: true }),
  viewport: { width: 1440, height: 700 },
  prepare: async (page) => {
    const viewSwitch = page.getByRole("tablist", { name: "Data view" });
    await viewSwitch.waitFor();
    await viewSwitch.getByRole("tab", { name: "Dictionary" }).click();
    const failure = page.getByText("The columns could not be loaded.");
    await failure.waitFor({ timeout: 30000 });
    const retry = page.getByRole("button", { name: "Try again" });
    const dataTab = page.getByRole("tab", { name: "Data", exact: true });

    const marker = new ChangeMarker(page);
    await marker.mark([failure, retry], "New", "above");
    return marker.frame([dataTab, viewSwitch, retry], 24);
  },
};

const drawerReadOnly: TicketShot = {
  slug: "a6-drawer-read-only",
  route: async () => `${await dataRoute()}?access=view`,
  fixtures: dictionaryFixtures(),
  viewport: { width: 1440, height: 1000 },
  prepare: async (page) => {
    const drawer = await openColumn(
      page,
      "View the description of leaf_temperature",
      "4 of 6 columns described",
    );
    await drawer
      .getByText("Only this experiment's admins and members can describe its columns.")
      .waitFor();
    await blurFocus(page);
    await hideWalkThrough(page);

    await markDrawer(page, drawer);
    return undefined;
  },
};

const describeDrawer: TicketShot = {
  slug: "a6-describe-drawer",
  route: dataRoute,
  fixtures: dictionaryFixtures(),
  viewport: { width: 1440, height: 1400 },
  prepare: async (page) => {
    const drawer = await openColumn(page, "Describe relative_humidity", "4 of 6 columns described");
    await drawer.getByRole("textbox", { name: /^Trait/ }).fill("Relative humidity of the air");
    await drawer.getByLabel("Method", { exact: true }).fill(READING);
    await drawer.getByLabel("Scale", { exact: true }).fill(MEASURED_NUMBER);
    await drawer.getByLabel("Unit", { exact: true }).fill("%");
    await blurFocus(page);
    await hideWalkThrough(page);

    await markDrawer(page, drawer);
    return undefined;
  },
};

const termPicker: TicketShot = {
  slug: "a6-term-picker",
  route: dataRoute,
  fixtures: dictionaryFixtures(),
  viewport: { width: 1440, height: 1100 },
  prepare: async (page) => {
    const drawer = await openColumn(page, "Describe relative_humidity", "4 of 6 columns described");
    await drawer.getByRole("textbox", { name: /^Trait/ }).fill("Relative humidity of the air");
    await drawer.getByRole("combobox", { name: "Crop Ontology term for the trait" }).click();
    await page.getByPlaceholder("Search terms by name").fill("humidity");
    await page.getByText("CO_336:0000303").waitFor();
    await hideWalkThrough(page);

    const popover = page.locator("[data-radix-popper-content-wrapper]");
    const marker = new ChangeMarker(page);
    await marker.mark([popover], "New", "outside-left");
    return undefined;
  },
};

const suggestion: TicketShot = {
  slug: "a7-suggestion",
  route: dataRoute,
  fixtures: dictionaryFixtures({ hasSuggestions: true }),
  viewport: { width: 1440, height: 980 },
  prepare: async (page) => {
    const drawer = await openColumn(page, "Describe quality_flag", "4 of 6 columns described");
    const banner = drawer.getByRole("status").filter({ hasText: "Suggested description" });
    await banner.getByText("Same macro field in 3 other experiments").waitFor();
    await blurFocus(page);

    const marker = new ChangeMarker(page);
    await marker.mark(banner, "New", "inside-top-right");
    return marker.frame([drawer], 0);
  },
};

const suggestionApplied: TicketShot = {
  slug: "a7-suggestion-applied",
  route: dataRoute,
  fixtures: dictionaryFixtures({ hasSuggestions: true }),
  viewport: { width: 1440, height: 980 },
  prepare: async (page) => {
    const drawer = await openColumn(page, "Describe quality_flag", "4 of 6 columns described");
    await drawer.getByRole("button", { name: "Use this description" }).click();
    const banner = drawer.getByRole("status");
    await banner.getByText("Filled in from the suggestion").waitFor();
    await blurFocus(page);
    await banner.evaluate((element) => {
      element.style.marginTop = "32px";
    });

    const marker = new ChangeMarker(page);
    await marker.mark(banner, "New", "above");
    return marker.frame([drawer], 0);
  },
};

const reviewSuggestions: TicketShot = {
  slug: "a7-review-suggestions",
  route: dataRoute,
  fixtures: dictionaryFixtures({ hasSuggestions: true }),
  viewport: { width: 1440, height: 1260 },
  prepare: async (page) => {
    await openDictionary(page, "4 of 6 columns described");
    const review = page.getByRole("button", { name: "Review suggestions" });
    const viewSwitch = page.getByRole("tablist", { name: "Data view" });
    const root = dictionaryRoot(page);
    const dataTab = page.getByRole("tab", { name: "Data", exact: true });
    const suggestedCells = page
      .getByRole("cell")
      .filter({ has: page.getByText("Suggested", { exact: true }) });

    const marker = new ChangeMarker(page);
    await marker.mark([review], "New", "above");
    for (const cell of await suggestedCells.all()) {
      await marker.mark(cell, "New", "inside-right");
    }
    return marker.frame([dataTab, viewSwitch, root], 24);
  },
};

const saveAndNext: TicketShot = {
  slug: "a8-save-and-next",
  route: dataRoute,
  fixtures: dictionaryFixtures(),
  viewport: { width: 1440, height: 1100 },
  prepare: async (page) => {
    await openDictionary(page, "4 of 6 columns described");
    await page.getByRole("combobox", { name: "Show" }).click();
    await page.getByRole("option", { name: "Not yet described" }).click();
    await page.getByRole("button", { name: "Describe relative_humidity", exact: true }).click();
    const drawer = page.getByRole("dialog");
    await drawer.getByRole("button", { name: "Save and next" }).waitFor();
    await drawer.getByRole("textbox", { name: /^Trait/ }).fill("Relative humidity of the air");
    await blurFocus(page);

    // The scrim hides the filter from the accessibility tree, so it is found by its markup.
    const filter = page.locator('[role="combobox"][aria-label="Show"]');
    const marker = new ChangeMarker(page);
    await marker.mark(filter, "New", "above");
    await marker.mark(drawer.getByRole("button", { name: "Save and next" }), "New", "above");
    return undefined;
  },
};

const earlierVersion: TicketShot = {
  slug: "a9-earlier-version",
  route: dataRoute,
  fixtures: dictionaryFixtures({ hasNewVersion: true }),
  viewport: { width: 1440, height: 1000 },
  prepare: async (page) => {
    const drawer = await openColumn(page, "Describe leaf_temperature", "4 of 9 columns described");
    const banner = drawer
      .getByRole("status")
      .filter({ hasText: "Described in an earlier version" });
    await banner.getByText("Same column in version 4 of this workbook").waitFor();
    await blurFocus(page);
    await hideWalkThrough(page);

    const marker = new ChangeMarker(page);
    await marker.mark(banner, "New", "inside-top-right");
    return marker.frame([drawer], 0);
  },
};

const newVersionList: TicketShot = {
  slug: "a9-new-version-list",
  route: dataRoute,
  fixtures: dictionaryFixtures({ hasNewVersion: true }),
  viewport: { width: 1440, height: 1500 },
  prepare: async (page) => {
    await openDictionary(page, "4 of 9 columns described");
    await hideWalkThrough(page);
    const viewSwitch = page.getByRole("tablist", { name: "Data view" });
    const root = dictionaryRoot(page);
    const dataTab = page.getByRole("tab", { name: "Data", exact: true });
    const newest = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Field readings, version 5" }) });

    const marker = new ChangeMarker(page);
    await marker.mark(newest, "New", "inside-top-right");
    return marker.frame([dataTab, viewSwitch, root], 24);
  },
};

export const SHOTS_A: readonly TicketShot[] = [
  funding,
  dataDictionary,
  dictionaryFailed,
  describeDrawer,
  drawerReadOnly,
  termPicker,
  suggestion,
  suggestionApplied,
  reviewSuggestions,
  saveAndNext,
  earlierVersion,
  newVersionList,
];
