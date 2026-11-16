import type { Locator, Page, Request } from "@playwright/test";

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
import { droughtTrialStudyRecord, waitForStudyRecord } from "./study-metadata-shots.js";

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
  fixtures: [droughtTrialStudyRecord],
  viewport: { width: 1440, height: 1500 },
  prepare: async (page) => {
    await waitForStudyRecord(page);
    await studySection(page).getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog");
    await waitForStudyRecord(dialog);

    const section = dialog.getByRole("region", { name: "Funding" });
    await section.getByRole("button", { name: "Add funding" }).click();
    await section.getByLabel("Funder", { exact: true }).fill("Example Research Council");
    await section.getByLabel("Award number").fill("EX-2026-001");
    await blurFocus(page);
    await section.scrollIntoViewIfNeeded();

    const marker = new ChangeMarker(page);
    await marker.mark(section, "New", "inside-top-right");
    return marker.frame([dialog], 16);
  },
};

// Every term below was opened on its source on 9 November 2026: the CF standard name table version
// 95, the EBI Ontology Lookup Service for ENVO, TO and PATO, and cropontology.org for rice.
const CF = "CF standard names";
const ENVO = "Environment Ontology (ENVO)";
const TO = "Plant Trait Ontology (TO)";
const PATO = "Phenotype And Trait Ontology (PATO)";
const RICE = "Crop Ontology, rice (CO_320)";

const CF_AIR_TEMPERATURE: ColumnTerm = {
  id: "air_temperature",
  label: "Air temperature",
  vocabulary: CF,
  iri: "https://vocab.nerc.ac.uk/standard_name/air_temperature/",
  definition:
    "Air temperature is the bulk temperature of the air, not the surface (skin) temperature.",
};
const CF_RELATIVE_HUMIDITY: ColumnTerm = {
  id: "relative_humidity",
  label: "Relative humidity",
  vocabulary: CF,
  iri: "https://vocab.nerc.ac.uk/standard_name/relative_humidity/",
};
const CF_SPECIFIC_HUMIDITY: ColumnTerm = {
  id: "specific_humidity",
  label: "Specific humidity",
  vocabulary: CF,
  iri: "https://vocab.nerc.ac.uk/standard_name/specific_humidity/",
  definition: "Specific humidity is the mass fraction of water vapor in (moist) air.",
};
const CF_CANOPY_TEMPERATURE: ColumnTerm = {
  id: "canopy_temperature",
  label: "Canopy temperature",
  vocabulary: CF,
  iri: "https://vocab.nerc.ac.uk/standard_name/canopy_temperature/",
  definition:
    '"Canopy temperature" is the bulk temperature of the canopy, not the surface (skin) temperature.',
};
const ENVO_AIR: ColumnTerm = {
  id: "ENVO:00002005",
  label: "air",
  vocabulary: ENVO,
  iri: "http://purl.obolibrary.org/obo/ENVO_00002005",
};
const ENVO_HUMID_AIR: ColumnTerm = {
  id: "ENVO:01000828",
  label: "humid air",
  vocabulary: ENVO,
  iri: "http://purl.obolibrary.org/obo/ENVO_01000828",
  definition: "Air which has increased levels of water vapour.",
};
const ENVO_PPFD: ColumnTerm = {
  id: "ENVO:06105204",
  label: "photosynthetic photon flux density",
  vocabulary: ENVO,
  iri: "http://purl.obolibrary.org/obo/ENVO_06105204",
  definition:
    "Often represented in micromoles of photons associated with photosynthetically active radiation per square meter per second.",
};
const TO_LEAF_TEMPERATURE: ColumnTerm = {
  id: "TO:0000504",
  label: "leaf temperature",
  vocabulary: TO,
  iri: "http://purl.obolibrary.org/obo/TO_0000504",
  definition: "A leaf morphology trait (TO:0000748) which is the leaf surface temperature.",
};
const PATO_HUMIDITY: ColumnTerm = {
  id: "PATO:0015009",
  label: "humidity",
  vocabulary: PATO,
  iri: "http://purl.obolibrary.org/obo/PATO_0015009",
  definition:
    "A quality inhering in air by virtue of the partial pressure exerted by the bearer's water vapour content.",
};
const RICE_LEAF_TEMPERATURE: ColumnTerm = {
  id: "CO_320:0001118",
  label: "Leaf temperature",
  vocabulary: RICE,
  definition: "Leaf surface temperature",
};

const HUMIDITY_TERMS: readonly ColumnTerm[] = [
  CF_RELATIVE_HUMIDITY,
  CF_SPECIFIC_HUMIDITY,
  PATO_HUMIDITY,
  ENVO_HUMID_AIR,
];
const LEAF_TEMPERATURE_TERMS: readonly ColumnTerm[] = [
  TO_LEAF_TEMPERATURE,
  RICE_LEAF_TEMPERATURE,
  CF_CANOPY_TEMPERATURE,
];

const MACRO_ID = "00000000-0000-4000-8000-0000000000a5";
const WORKBOOK_NAME = "Field readings";

const AMBIT_4: ColumnProducer = {
  kind: "instrument",
  workbookVersion: 4,
  workbookName: WORKBOOK_NAME,
  instrumentFamily: "Ambit",
};
const AMBIT_5: ColumnProducer = { ...AMBIT_4, workbookVersion: 5 };
const AMBYTE_UPLOAD: ColumnProducer = { kind: "upload", parserName: "Ambyte", parserVersion: "2" };
const DAILY_MEANS: ColumnProducer = { kind: "macro", macroId: MACRO_ID, macroName: "Daily means" };
const FROM_LAYOUT: ColumnProducer = { kind: "layout" };

const AMBIT_METHOD = "Reading from the Ambit, Field readings version 4";
const DAILY_MEAN_METHOD = "Computed by the Daily means macro";
const PAR = "photosynthetically active radiation";

function described(
  parts: Pick<ColumnDescription, "definition" | "property" | "propertyTerm" | "unit"> &
    Partial<ColumnDescription>,
): ColumnDescription {
  return {
    noTermFits: false,
    objectOfInterest: null,
    objectOfInterestTerm: null,
    context: null,
    contextTerm: null,
    method: AMBIT_METHOD,
    valueKind: "number",
    processingLevel: "measured",
    ...parts,
  };
}

const AIR_TEMPERATURE = described({
  definition: "Temperature of the air around the Ambit at each reading",
  property: "Temperature",
  propertyTerm: CF_AIR_TEMPERATURE,
  objectOfInterest: "air",
  objectOfInterestTerm: ENVO_AIR,
  unit: "Cel",
});
const LIGHT = described({
  definition: "Photosynthetically active radiation reaching the Ambit's light sensor",
  property: "Photon flux density",
  propertyTerm: ENVO_PPFD,
  objectOfInterest: PAR,
  unit: "umol/(m2.s)",
});
const LEAF_TEMPERATURE = described({
  definition: "Surface temperature of the leaf the Ambit's infrared sensor faces",
  property: "Temperature",
  propertyTerm: TO_LEAF_TEMPERATURE,
  objectOfInterest: "leaf",
  unit: "Cel",
});

interface ExampleColumn {
  name: string;
  type: "DOUBLE" | "STRING";
  rowCount: number;
  description: ColumnDescription | null;
}

type AmbitColumn =
  | "air_temperature_c"
  | "relative_humidity_pct"
  | "par_umol_m2_s"
  | "contactless_temperature_c";

/** The Ambit's computed outputs, as the pipeline's derived-parameter allowlist names them. */
const AMBIT_COLUMNS: readonly AmbitColumn[] = [
  "air_temperature_c",
  "relative_humidity_pct",
  "par_umol_m2_s",
  "contactless_temperature_c",
];

const DESCRIBED_AT_VERSION_4: Partial<Record<AmbitColumn, ColumnDescription>> = {
  air_temperature_c: AIR_TEMPERATURE,
  par_umol_m2_s: LIGHT,
  contactless_temperature_c: LEAF_TEMPERATURE,
};

/** The trace temperature and the leaf temperature, which the split Ambyte parser keeps apart. */
const AMBYTE_COLUMNS: readonly ExampleColumn[] = [
  { name: "Temp", type: "DOUBLE", rowCount: 8640, description: null },
  { name: "LeafT", type: "DOUBLE", rowCount: 1440, description: null },
];

const MACRO_COLUMNS: readonly ExampleColumn[] = [
  {
    name: "daily_mean_air_temperature_c",
    type: "DOUBLE",
    rowCount: 96,
    description: described({
      ...AIR_TEMPERATURE,
      definition: "Mean of one day's air temperature readings for one plot",
      context: "daily mean",
      method: DAILY_MEAN_METHOD,
      processingLevel: "computed",
    }),
  },
  {
    name: "daily_mean_par_umol_m2_s",
    type: "DOUBLE",
    rowCount: 96,
    description: described({
      ...LIGHT,
      definition: "Mean of one day's light readings for one plot",
      context: "daily mean",
      method: DAILY_MEAN_METHOD,
      processingLevel: "computed",
    }),
  },
];

const HUMIDITY_SUGGESTION: ColumnSuggestion = {
  description: described({
    definition: "Relative humidity of the air around the Ambit at each reading",
    property: "Relative humidity",
    propertyTerm: CF_RELATIVE_HUMIDITY,
    objectOfInterest: "air",
    objectOfInterestTerm: ENVO_AIR,
    unit: "%",
  }),
  experimentCount: 3,
};

const INSTRUMENT_ROWS = 1240;

function instrumentRows(): FixtureRow[] {
  const plots = examplePlots();
  return Array.from({ length: INSTRUMENT_ROWS }, (_, index) => {
    const isHumidityMissing = index % 20 === 0 && index < 1200;
    return {
      plot: plots[index % plots.length].identifier,
      air_temperature_c: Number((24 + ((index * 7) % 60) / 10).toFixed(1)),
      relative_humidity_pct: isHumidityMissing ? null : 40 + ((index * 13) % 40),
      par_umol_m2_s: 400 + ((index * 37) % 900),
      contactless_temperature_c: Number((23 + ((index * 11) % 50) / 10).toFixed(1)),
    };
  });
}

function macroRows(): FixtureRow[] {
  return Array.from({ length: 96 }, (_, index) => ({
    daily_mean_air_temperature_c: Number((25 + ((index * 3) % 40) / 10).toFixed(1)),
    daily_mean_par_umol_m2_s: 650 + ((index * 29) % 300),
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
  [{ name: "plot", type: "STRING" }, ...AMBIT_COLUMNS.map((name) => ({ name, type: "DOUBLE" }))],
  instrumentRows(),
);
const MACRO_TABLE = fixtureTable(
  MACRO_ID,
  "Processed Data (Daily means)",
  MACRO_COLUMNS,
  macroRows(),
);

/** Every Ambit column holds a value on each reading except humidity, which the sensor sometimes skips. */
function ambitRowCounts(readings: number, humidity: number): Record<AmbitColumn, number> {
  return {
    air_temperature_c: readings,
    relative_humidity_pct: humidity,
    par_umol_m2_s: readings,
    contactless_temperature_c: readings,
  };
}

interface DictionaryState {
  /** Another experiment or an earlier workbook version described the column, so it reads Suggested. */
  hasSuggestions?: boolean;
  /** Workbook version 5 exists beside version 4 and its columns point back at version 4's. */
  hasNewVersion?: boolean;
  /** The columns request fails, so the view shows its error. */
  isFailing?: boolean;
}

/**
 * The drought trial's columns from an Ambit workbook, an Ambyte upload, one macro and the layout.
 * Answers the tables list with the right table types and the scaffold's dictionary, describe, term
 * search and suggestion routes, which have no backend yet.
 */
class ExampleColumnDictionary implements Fixture {
  constructor(private readonly state: DictionaryState = {}) {}

  async install(page: Page): Promise<void> {
    const prefix = `/api/v1/experiments/${await resolve(DROUGHT_TRIAL)}`;
    const answers = new Map<string, (url: URL, request: Request) => unknown>([
      [`${prefix}/tables`, () => this.tables()],
      [`${prefix}/columns`, () => this.dictionary()],
      [`${prefix}/columns/description`, (_, request) => this.saved(request)],
      [`${prefix}/columns/suggestion`, (url) => this.suggestion(url)],
      ["/api/v1/column-terms/search", (url) => this.terms(url)],
    ]);
    const failing = `${prefix}/columns`;

    await page.route(
      (url) => answers.has(url.pathname),
      async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (this.state.isFailing && url.pathname === failing) {
          await route.fulfill({ status: 500, json: { message: "The warehouse did not answer." } });
          return;
        }
        const answer = answers.get(url.pathname);
        await route.fulfill({ status: 200, json: answer ? answer(url, request) : null });
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
    const version4 = this.ambitColumns(
      "workbook-4",
      hasNewVersion ? ambitRowCounts(840, 790) : ambitRowCounts(INSTRUMENT_ROWS, 1180),
    );
    const groups: ColumnDictionary["groups"] = [];

    if (hasNewVersion) {
      const version5 = this.ambitColumns("workbook-5", ambitRowCounts(400, 390), "workbook-4");
      groups.push({ producer: AMBIT_5, columns: version5 });
    }
    groups.push({ producer: AMBIT_4, columns: version4 });
    groups.push({ producer: AMBYTE_UPLOAD, columns: this.columns("ambyte-2", AMBYTE_COLUMNS) });
    groups.push({ producer: DAILY_MEANS, columns: this.columns(MACRO_ID, MACRO_COLUMNS) });
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

  private ambitColumns(
    producerKey: string,
    rowCounts: Record<AmbitColumn, number>,
    previousKey?: string,
  ): DictionaryColumn[] {
    const isOldVersion = producerKey === "workbook-4";

    return AMBIT_COLUMNS.map((name) => ({
      identity: `${producerKey}:${name}`,
      name,
      type: "DOUBLE",
      rowCount: rowCounts[name],
      description: isOldVersion ? (DESCRIBED_AT_VERSION_4[name] ?? null) : null,
      previous: previousKey ? `${previousKey}:${name}` : null,
      isSuggested: this.isSuggested(name, isOldVersion),
    }));
  }

  private columns(producerKey: string, columns: readonly ExampleColumn[]): DictionaryColumn[] {
    return columns.map(({ name, type, rowCount, description }) => ({
      identity: `${producerKey}:${name}`,
      name,
      type,
      rowCount,
      description,
      previous: null,
      isSuggested: false,
    }));
  }

  private isSuggested(name: string, isOldVersion: boolean): boolean {
    return this.state.hasSuggestions === true && isOldVersion && name === "relative_humidity_pct";
  }

  private suggestion(url: URL): ColumnSuggestion | null {
    const isHumidity = url.searchParams.get("column") === "workbook-4:relative_humidity_pct";
    return this.state.hasSuggestions === true && isHumidity ? HUMIDITY_SUGGESTION : null;
  }

  /** Echoes the saved description, as the backend will. */
  private saved(request: Request): unknown {
    return request.postDataJSON();
  }

  private terms(url: URL): { terms: readonly ColumnTerm[] } {
    const query = (url.searchParams.get("query") ?? "").toLowerCase();
    return { terms: query.includes("humid") ? HUMIDITY_TERMS : LEAF_TEMPERATURE_TERMS };
  }
}

function warehouse(): Fixture {
  return new FixtureWarehouse(DROUGHT_TRIAL, [INSTRUMENT_TABLE, MACRO_TABLE]);
}

function dictionaryFixtures(state: DictionaryState = {}): readonly Fixture[] {
  return [warehouse(), new ExampleColumnDictionary(state)];
}

const DESCRIBED_COUNT = "5 of 8 columns described";

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
  // The pointer stays where the row was and would leave a hover on whatever the drawer opens over it.
  await page.mouse.move(0, 0);
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

async function describeHumidity(drawer: Locator): Promise<void> {
  await drawer
    .getByRole("textbox", { name: /^Definition/ })
    .fill("Relative humidity of the air around the Ambit at each reading");
  await drawer.getByRole("textbox", { name: /^Property/ }).fill("Relative humidity");
}

const dataDictionary: TicketShot = {
  slug: "a4-data-dictionary",
  route: dataRoute,
  fixtures: dictionaryFixtures(),
  viewport: { width: 1440, height: 1500 },
  prepare: async (page) => {
    await openDictionary(page, DESCRIBED_COUNT);
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
  slug: "a4-dictionary-failed",
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
  slug: "a5-drawer-read-only",
  route: async () => `${await dataRoute()}?access=view`,
  fixtures: dictionaryFixtures(),
  viewport: { width: 1440, height: 1300 },
  prepare: async (page) => {
    const drawer = await openColumn(
      page,
      "View the description of air_temperature_c",
      DESCRIBED_COUNT,
    );
    await drawer
      .getByText("Only people who can edit this experiment can describe its columns.")
      .waitFor();
    await blurFocus(page);
    await hideWalkThrough(page);

    await markDrawer(page, drawer);
    return undefined;
  },
};

const describeDrawer: TicketShot = {
  slug: "a5-describe-drawer",
  route: dataRoute,
  fixtures: dictionaryFixtures(),
  viewport: { width: 1440, height: 1500 },
  prepare: async (page) => {
    const drawer = await openColumn(page, "Describe relative_humidity_pct", DESCRIBED_COUNT);
    await describeHumidity(drawer);
    await drawer.getByRole("textbox", { name: "Object of interest" }).fill("air");
    await drawer.getByRole("textbox", { name: "Unit" }).fill("%");
    await blurFocus(page);
    await hideWalkThrough(page);

    await markDrawer(page, drawer);
    return undefined;
  },
};

const termPicker: TicketShot = {
  slug: "a5-term-picker",
  route: dataRoute,
  fixtures: dictionaryFixtures(),
  viewport: { width: 1440, height: 1100 },
  prepare: async (page) => {
    const drawer = await openColumn(page, "Describe LeafT", DESCRIBED_COUNT);
    await drawer
      .getByRole("textbox", { name: /^Definition/ })
      .fill("Leaf temperature from the Ambyte's leaf sensor");
    await drawer.getByRole("textbox", { name: /^Property/ }).fill("Temperature");
    await drawer.getByRole("combobox", { name: "Term for the property" }).click();
    await page.getByPlaceholder("Search terms by name").fill("leaf temperature");
    await page.getByText(RICE_LEAF_TEMPERATURE.id).waitFor();
    await hideWalkThrough(page);

    const popover = page.locator("[data-radix-popper-content-wrapper]");
    const marker = new ChangeMarker(page);
    await marker.mark([popover], "New", "outside-left");
    return undefined;
  },
};

const suggestion: TicketShot = {
  slug: "a6-suggestion",
  route: dataRoute,
  fixtures: dictionaryFixtures({ hasSuggestions: true }),
  viewport: { width: 1440, height: 1300 },
  prepare: async (page) => {
    const drawer = await openColumn(page, "Describe relative_humidity_pct", DESCRIBED_COUNT);
    const banner = drawer.getByRole("status").filter({ hasText: "Suggested description" });
    await banner.getByText("Same instrument field in 3 other experiments").waitFor();
    await blurFocus(page);

    const marker = new ChangeMarker(page);
    await marker.mark(banner, "New", "inside-top-right");
    return marker.frame([drawer], 0);
  },
};

const suggestionApplied: TicketShot = {
  slug: "a6-suggestion-applied",
  route: dataRoute,
  fixtures: dictionaryFixtures({ hasSuggestions: true }),
  viewport: { width: 1440, height: 1300 },
  prepare: async (page) => {
    const drawer = await openColumn(page, "Describe relative_humidity_pct", DESCRIBED_COUNT);
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
  slug: "a6-review-suggestions",
  route: dataRoute,
  fixtures: dictionaryFixtures({ hasSuggestions: true }),
  viewport: { width: 1440, height: 1500 },
  prepare: async (page) => {
    await openDictionary(page, DESCRIBED_COUNT);
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

async function openNotYetDescribed(page: Page, column: string): Promise<Locator> {
  await openDictionary(page, DESCRIBED_COUNT);
  await page.getByRole("combobox", { name: "Show" }).click();
  await page.getByRole("option", { name: "Not yet described" }).click();
  await page.getByRole("button", { name: `Describe ${column}`, exact: true }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("button", { name: "Save and next" }).waitFor();
  await page.mouse.move(0, 0);
  return drawer;
}

const saveAndNext: TicketShot = {
  slug: "a7-save-and-next",
  route: dataRoute,
  fixtures: dictionaryFixtures(),
  viewport: { width: 1440, height: 1500 },
  prepare: async (page) => {
    const drawer = await openNotYetDescribed(page, "relative_humidity_pct");
    await describeHumidity(drawer);
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
  slug: "a8-earlier-version",
  route: dataRoute,
  fixtures: dictionaryFixtures({ hasNewVersion: true }),
  viewport: { width: 1440, height: 1500 },
  prepare: async (page) => {
    const drawer = await openColumn(
      page,
      "Describe air_temperature_c",
      "5 of 12 columns described",
    );
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
  slug: "a8-new-version-list",
  route: dataRoute,
  fixtures: dictionaryFixtures({ hasNewVersion: true }),
  viewport: { width: 1440, height: 1900 },
  prepare: async (page) => {
    await openDictionary(page, "5 of 12 columns described");
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
