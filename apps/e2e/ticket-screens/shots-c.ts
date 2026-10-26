import type { Locator, Page } from "@playwright/test";

import { experimentId } from "../docs-media/seed-entities.js";
import { ChangeMarker } from "./change-marker.js";
import type { ExamplePlot } from "./example-field.js";
import {
  exampleFieldLayout,
  exampleLayoutFixture,
  examplePlots,
  FIELD_COLUMNS,
  FIELD_ROWS,
  rowLetter,
  TREATMENTS,
} from "./example-field.js";
import type { FixtureRow, FixtureTable } from "./fixture-tables.js";
import { FixtureTransform } from "./fixture-transform.js";
import { FixtureWarehouse } from "./fixture-warehouse.js";
import type { Fixture, Resolvable } from "./fixture.js";
import { resolve } from "./fixture.js";
import type { TicketShot } from "./shots.js";

const DROUGHT_TRIAL: Resolvable = () => experimentId("Drought trial (example data)");
const VIEWPORT = { width: 1440, height: 1000 };
const PLOT_MAP_SHEET = "Plot map";

async function layoutRoute(view?: string): Promise<string> {
  const path = `/platform/experiments/${await resolve(DROUGHT_TRIAL)}/layout`;
  return view === undefined ? path : `${path}?view=${view}`;
}

// CSS rather than roles, since an open dialog or list hides the rest of the page from role queries.
function layoutTab(page: Page): Locator {
  return page.locator("[role=tab]", { hasText: /^Layout$/ });
}

function viewSwitch(page: Page): Locator {
  return page.locator('[role=tablist][aria-label="Layout views"]');
}

function card(locator: Locator): Locator {
  return locator.locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
}

function setupSummary(page: Page): Locator {
  return card(page.getByText("Readings", { exact: true }));
}

function plotGrid(page: Page, title = "Plot grid"): Locator {
  return card(page.getByText(title, { exact: true }));
}

/** Answers one experiment-scoped API path, such as `layout/attributes`, for whichever experiment asks. */
class ExperimentPath implements Fixture {
  constructor(
    private readonly suffix: string,
    private readonly body: unknown,
    private readonly status = 200,
  ) {}

  async install(page: Page): Promise<void> {
    const pattern = new RegExp(`^/api/v1/experiments/[^/]+/${this.suffix}$`);
    await page.route(
      (url) => pattern.test(url.pathname),
      (route) => route.fulfill({ status: this.status, json: this.body }),
    );
  }
}

/** The layout route with the example field and a change no table can hold yet. */
function exampleLayoutWith(changes: Record<string, unknown>): Fixture {
  return new ExperimentPath("layout", { ...exampleFieldLayout(), ...changes });
}

const noLayout = new ExperimentPath("layout", null);
const noPlacements = new ExperimentPath("layout/placements", []);

// Each ticket builds on C2's Plots view alone, so a shot hides the toolbar controls other tickets add.
const TOOLBAR_BUTTONS = {
  search: "[data-plot-search]",
  addAttributes: "Add treatments and genotypes",
  markGaps: "Mark gaps",
  anchor: "Anchor on map",
} as const;

type ToolbarControl = keyof typeof TOOLBAR_BUTTONS;

function toolbarControl(page: Page, control: ToolbarControl): Locator {
  return control === "search"
    ? page.locator(TOOLBAR_BUTTONS.search)
    : page.getByRole("button", { name: TOOLBAR_BUTTONS[control], exact: true });
}

/** Takes parts of the page out of one shot, leaving the components that render them untouched. */
async function hideElements(targets: readonly Locator[]): Promise<void> {
  for (const target of targets) {
    await target.evaluate((element) => {
      if (element instanceof HTMLElement) {
        element.style.display = "none";
      }
    });
  }
}

async function hideToolbar(page: Page, keep: readonly ToolbarControl[] = []): Promise<void> {
  const controls: ToolbarControl[] = ["search", "addAttributes", "markGaps", "anchor"];
  const hidden = controls.filter((control) => !keep.includes(control));
  await hideElements(hidden.map((control) => toolbarControl(page, control)));
}

/** A second outline in the marker's color with no tag, for a part that belongs to a tagged mark. */
async function outline(page: Page, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  if (box === null) throw new Error("The outlined target is not on the page");
  await page.evaluate((box) => {
    const pad = 3;
    const frame = document.createElement("div");
    Object.assign(frame.style, {
      position: "fixed",
      left: `${box.x - pad}px`,
      top: `${box.y - pad}px`,
      width: `${box.width + pad * 2}px`,
      height: `${box.height + pad * 2}px`,
      border: "2.5px solid #EA580C",
      borderRadius: "8px",
      pointerEvents: "none",
      zIndex: "2147483646",
    });
    document.body.append(frame);
  }, box);
}

async function pasteText(page: Page, text: string): Promise<void> {
  await page.evaluate((text) => {
    const data = new DataTransfer();
    data.setData("text/plain", text);
    document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data }));
  }, text);
}

function plotCell(page: Page, identifier: string): Locator {
  return page.getByRole("button", { name: identifier, exact: true });
}

const plotsView: TicketShot = {
  slug: "c2-plots-view",
  route: () => layoutRoute(),
  fixtures: [exampleLayoutFixture],
  viewport: VIEWPORT,
  prepare: async (page) => {
    await plotGrid(page).waitFor();
    await hideToolbar(page);
    await page.mouse.move(0, 0);

    const marker = new ChangeMarker(page);
    await marker.mark(layoutTab(page), "New", "above");
    await marker.mark([viewSwitch(page), setupSummary(page), plotGrid(page)], "New", "below");
    return marker.frame(
      [layoutTab(page), viewSwitch(page), setupSummary(page), plotGrid(page)],
      24,
    );
  },
};

const firstRun: TicketShot = {
  slug: "c2-first-run",
  route: () => layoutRoute(),
  fixtures: [noLayout],
  viewport: VIEWPORT,
  prepare: async (page) => {
    const empty = card(page.getByText("No plots yet", { exact: true }));
    await empty.waitFor();
    await page.mouse.move(0, 0);

    const marker = new ChangeMarker(page);
    await marker.mark([viewSwitch(page), empty], "New", "below");
    return marker.frame([layoutTab(page), viewSwitch(page), empty], 24);
  },
};

const defineLayout: TicketShot = {
  slug: "c2-define-layout",
  route: () => layoutRoute(),
  fixtures: [noLayout],
  viewport: VIEWPORT,
  prepare: async (page) => {
    await page.getByRole("button", { name: "Define layout" }).click();
    const setup = card(page.getByText("Define the layout", { exact: true }));
    await setup.waitFor();
    // Only the setup card and the preview belong to C2; the paste and the term are other tickets.
    await hideElements([
      page.getByRole("button", { name: "Paste a plot list" }),
      page.locator("[data-term-section]"),
    ]);

    await page.mouse.move(0, 0);

    const preview = plotGrid(page, "Preview");
    const marker = new ChangeMarker(page);
    await marker.mark([setup, preview], "New", "below");
    return marker.frame([layoutTab(page), viewSwitch(page), setup, preview], 24);
  },
};

const viewNeedsPlots: TicketShot = {
  slug: "c2-view-switch",
  route: () => layoutRoute("walking-order"),
  fixtures: [noLayout],
  viewport: VIEWPORT,
  prepare: async (page) => {
    const empty = card(page.getByText("The walking order needs plots", { exact: true }));
    await empty.waitFor();
    await page.mouse.move(0, 0);

    const marker = new ChangeMarker(page);
    await marker.mark([viewSwitch(page), empty], "New", "below");
    return marker.frame([layoutTab(page), viewSwitch(page), empty], 24);
  },
};

const plotLegend: TicketShot = {
  slug: "c2-plot-legend",
  route: async () => `${await layoutRoute()}?legend=specimen`,
  fixtures: [exampleLayoutFixture],
  viewport: { width: VIEWPORT.width, height: 1500 },
  prepare: async (page) => {
    const specimen = page.locator("[data-legend-specimen]");
    await specimen.waitFor();
    await specimen.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);

    const marker = new ChangeMarker(page);
    await marker.mark(specimen, "New", "above");
    return marker.frame([specimen], 24);
  },
};

const loadError: TicketShot = {
  slug: "c2-load-error",
  route: () => layoutRoute(),
  fixtures: [new ExperimentPath("layout", { message: "Unavailable" }, 503)],
  viewport: VIEWPORT,
  prepare: async (page) => {
    const message = page.getByText("The layout could not be loaded.", { exact: true });
    await message.waitFor({ timeout: 20_000 });
    const error = message.locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
    await page.mouse.move(0, 0);

    const marker = new ChangeMarker(page);
    await marker.mark(error, "New", "below");
    return marker.frame([layoutTab(page), viewSwitch(page), error], 24);
  },
};

function plotAttributes(plot: ExamplePlot) {
  return [
    {
      name: "Treatment",
      value: plot.treatment,
      source: { type: "sheet", sheetName: PLOT_MAP_SHEET },
    },
    { name: "Genotype", value: plot.genotype, source: { type: "edit", sheetName: PLOT_MAP_SHEET } },
    { name: "Block", value: plot.block, source: { type: "sheet", sheetName: PLOT_MAP_SHEET } },
  ];
}

/** Answers one plot's route with its position and attributes, which no table holds yet. */
const plotInspectorFixture: Fixture = {
  install: async (page) => {
    const plots = examplePlots();
    await page.route(
      (url) => /^\/api\/v1\/experiments\/[^/]+\/layout\/plots\/[^/]+$/.test(url.pathname),
      (route) => {
        const plotId = new URL(route.request().url()).pathname.split("/").at(-1);
        const plot = plots.find((candidate) => candidate.id === plotId);
        if (plot === undefined) return route.fulfill({ status: 404, json: {} });
        const { id, parentId, identifier, row, column, active } = plot;
        return route.fulfill({
          status: 200,
          json: {
            unit: { id, parentId, identifier, row, column, active },
            levelName: "Plot",
            attributes: plotAttributes(plot),
          },
        });
      },
    );
  },
};

const plotInspector: TicketShot = {
  slug: "c3-plot-inspector",
  route: () => layoutRoute(),
  fixtures: [exampleLayoutFixture, plotInspectorFixture],
  viewport: VIEWPORT,
  prepare: async (page) => {
    await plotGrid(page).waitFor();
    await hideToolbar(page, ["search"]);

    const cell = plotCell(page, "C4");
    await cell.click();
    await page.getByText('From the sheet "Plot map", edited after upload').waitFor();
    // Place sensor here arrives with placing sensors, in milestone 3.
    await hideElements([page.locator("[data-place-sensor]")]);
    await page.mouse.move(0, 0);

    const panel = card(page.getByText("Plot C4", { exact: true }));
    const marker = new ChangeMarker(page);
    await marker.mark(panel, "New", "above");
    await outline(page, cell);
    await outline(page, toolbarControl(page, "search"));
    return marker.frame(
      [layoutTab(page), viewSwitch(page), setupSummary(page), plotGrid(page), panel],
      24,
    );
  },
};

const CGO = "https://www.tno.nl/agrifood/ontology/common-greenhouse-ontology#";

/** Classes from the published Common Greenhouse Ontology v1.3 that name a place a crop stands. */
const GREENHOUSE_TERMS = [
  { id: "cgo:Bench", label: "Bench", iri: `${CGO}Bench` },
  { id: "cgo:Compartment", label: "Compartment", iri: `${CGO}Compartment` },
  {
    id: "cgo:DrainCollectionTray",
    label: "Drain Collection Tray",
    iri: `${CGO}DrainCollectionTray`,
  },
  { id: "cgo:Zone", label: "Greenhouse Zone", iri: `${CGO}Zone` },
];

/** Answers the term search by matching labels, as the ontology lookup would. */
const termSearchFixture: Fixture = {
  install: async (page) => {
    await page.route(
      (url) => url.pathname === "/api/v1/layout/terms/search",
      (route) => {
        const query = (
          new URL(route.request().url()).searchParams.get("query") ?? ""
        ).toLowerCase();
        const matches = GREENHOUSE_TERMS.filter((term) => term.label.toLowerCase().includes(query));
        return route.fulfill({ status: 200, json: matches });
      },
    );
  },
};

const levelTerm: TicketShot = {
  slug: "c4-level-term",
  route: () => layoutRoute(),
  fixtures: [exampleLayoutWith({ levelName: "Bench" }), termSearchFixture],
  viewport: { width: VIEWPORT.width, height: 1100 },
  prepare: async (page) => {
    await plotGrid(page, "Bench grid").waitFor();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const setup = card(page.getByText("Edit the layout", { exact: true }));
    await setup.waitFor();

    const section = page.locator("[data-term-section]");
    await section.getByText("Standard term (optional)").click();
    await page.getByRole("combobox", { name: "Term", exact: true }).click();
    await page.getByPlaceholder("Search greenhouse terms").fill("bench");
    await page.getByRole("option", { name: /Bench/ }).first().waitFor();
    await page.mouse.move(0, 0);

    const list = page.locator("[data-radix-popper-content-wrapper]");
    const marker = new ChangeMarker(page);
    await marker.mark([section, list], "New", "inside-right");
    return marker.frame([layoutTab(page), viewSwitch(page), setup, plotGrid(page, "Preview")], 24);
  },
};

// The example field's anchor: plot A1's outer corner, row A running 30 degrees east of north with
// 2 m from one column to the next, and 3 m between rows.
const CORNER = { latitude: 52.0, longitude: 5.1 };
const BEARING = 30;
const COLUMN_SPACING = 2;
const ROW_SPACING = 3;

function moved(from: typeof CORNER, bearing: number, meters: number): typeof CORNER {
  const radians = (bearing * Math.PI) / 180;
  const latitude = (from.latitude * Math.PI) / 180;
  return {
    latitude: from.latitude + (meters * Math.cos(radians)) / 110_540,
    longitude: from.longitude + (meters * Math.sin(radians)) / (111_320 * Math.cos(latitude)),
  };
}

const NORTH_FIELD = {
  id: "5f2c1a7e-3b8d-4c61-9a0f-7e2d4b6c8a13",
  name: "North field",
  latitude: 52.00004,
  longitude: 5.10016,
  country: "Netherlands",
  createdAt: "2026-04-20T09:00:00.000Z",
  updatedAt: "2026-04-20T09:00:00.000Z",
};

const anchoredLayout = exampleLayoutWith({
  anchor: {
    locationId: NORTH_FIELD.id,
    corner: CORNER,
    rowEnd: moved(CORNER, BEARING, COLUMN_SPACING * FIELD_COLUMNS),
    rowSpacing: ROW_SPACING,
    isFlipped: false,
  },
});

async function waitForTiles(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const tiles = Array.from(document.querySelectorAll(".leaflet-tile"));
    return (
      tiles.length > 0 && tiles.every((tile) => tile.classList.contains("leaflet-tile-loaded"))
    );
  });
}

const geoAnchor: TicketShot = {
  slug: "c5-geo-anchor",
  route: () => layoutRoute(),
  fixtures: [anchoredLayout, new ExperimentPath("locations", [NORTH_FIELD])],
  // Taller than the others, so the anchor card holds its fields and the map unscrolled.
  viewport: { width: VIEWPORT.width, height: 1520 },
  prepare: async (page) => {
    await plotGrid(page).waitFor();
    await hideToolbar(page, ["anchor"]);

    await toolbarControl(page, "anchor").click();
    await page.locator("[data-anchor-derived]").waitFor();
    await waitForTiles(page);
    await page.mouse.move(0, 0);

    const anchor = card(page.getByText("Anchor on map", { exact: true }).last());
    const marker = new ChangeMarker(page);
    await marker.mark(anchor, "New", "above");
    await outline(page, toolbarControl(page, "anchor"));
    return marker.frame(
      [layoutTab(page), viewSwitch(page), setupSummary(page), plotGrid(page), anchor],
      24,
    );
  },
};

/** No sheet is saved yet; the metadata route reads the lakehouse, which the local stack cannot reach. */
const noSheetsFixture = new ExperimentPath("metadata", []);

/** A plot map with one row per grid position, gaps included, as a researcher would paste it. */
function plotMapSheet(): string {
  const lines = ["plot\ttreatment\tgenotype\tblock"];
  for (let row = 1; row <= FIELD_ROWS; row++) {
    for (let column = 1; column <= FIELD_COLUMNS; column++) {
      const genotype = column <= 4 ? "Line A" : "Line B";
      const block = String(Math.ceil(row / 2));
      lines.push(
        `${rowLetter(row)}${column}\t${TREATMENTS[(row + column) % 3]}\t${genotype}\t${block}`,
      );
    }
  }
  return lines.join("\n");
}

/** Answers the preview by counting the pasted names against the example field's plots. */
const sheetPreviewFixture: Fixture = {
  install: async (page) => {
    const plotNames = new Set(examplePlots().map((plot) => plot.identifier));
    await page.route(
      (url) => /^\/api\/v1\/experiments\/[^/]+\/layout\/sheet-preview$/.test(url.pathname),
      (route) => {
        const body: unknown = route.request().postDataJSON();
        const identifiers =
          typeof body === "object" &&
          body !== null &&
          "identifiers" in body &&
          Array.isArray(body.identifiers)
            ? body.identifiers.map(String)
            : [];
        const seen = new Set<string>();
        const duplicateNames: string[] = [];
        for (const name of identifiers) {
          if (seen.has(name)) duplicateNames.push(name);
          seen.add(name);
        }
        return route.fulfill({
          status: 200,
          json: {
            matchedRowCount: [...seen].filter((name) => plotNames.has(name)).length,
            unmatchedNames: [...seen].filter((name) => !plotNames.has(name)),
            duplicateNames,
            plotsWithoutRow: [...plotNames].filter((name) => !seen.has(name)),
            readingsWithPlot: 0,
          },
        });
      },
    );
  },
};

const sheetByPlot: TicketShot = {
  slug: "c6-sheet-by-plot",
  route: () => layoutRoute(),
  fixtures: [exampleLayoutFixture, noSheetsFixture, sheetPreviewFixture],
  // A little taller than the others, so the dialog holds the table, the select and the preview unscrolled.
  viewport: { width: VIEWPORT.width, height: 1100 },
  prepare: async (page) => {
    await plotGrid(page).waitFor();
    await toolbarControl(page, "addAttributes").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText("Import your metadata").waitFor();
    await pasteText(page, plotMapSheet());
    await dialog.getByText("48 rows imported").waitFor();
    await dialog.getByLabel("Name").fill(PLOT_MAP_SHEET);

    const preview = page.locator("[role=dialog] div.rounded-md", { hasText: "46 rows matched" });
    await preview.waitFor();
    await preview.evaluate((element) => element.scrollIntoView({ block: "end" }));
    await page.mouse.move(0, 0);

    const select = page.locator("#metadata-match-target");
    const marker = new ChangeMarker(page);
    await marker.mark([select, preview], "New", "inside-right");
    return marker.frame([page.locator("[role=dialog]", { hasText: "Import Metadata" })], 16);
  },
};

const addAttributes: TicketShot = {
  slug: "c6-add-attributes",
  route: () => layoutRoute(),
  fixtures: [exampleLayoutFixture],
  viewport: VIEWPORT,
  prepare: async (page) => {
    await plotGrid(page).waitFor();
    await hideToolbar(page, ["addAttributes"]);
    await page.mouse.move(0, 0);

    const button = toolbarControl(page, "addAttributes");
    const marker = new ChangeMarker(page);
    await marker.mark(button, "New", "above");
    return marker.frame(
      [layoutTab(page), viewSwitch(page), setupSummary(page), plotGrid(page)],
      24,
    );
  },
};

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const dataColumn = (name: string, type: string) => ({ name, type_name: type, type_text: type });
const round = (value: number, digits: number): number => Number(value.toFixed(digits));

const WALK_DAYS = [2, 9, 16];

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

/** Readings bound to plots, one walk of the example field a week for three weeks, in random order. */
function plotReadingRows(): FixtureRow[] {
  const random = seededRandom(7);
  const rows: FixtureRow[] = [];

  for (const day of WALK_DAYS) {
    shuffled(examplePlots(), random).forEach((plot, index) => {
      const light = round(400 + random() * 800, 0);
      const stress =
        plot.treatment === "Severe drought" ? 0.18 : plot.treatment === "Drought" ? 0.1 : 0;
      const line = plot.genotype === "Line B" ? 0.3 : 0;
      rows.push({
        timestamp: new Date(Date.UTC(2026, 5, day, 8, index * 2)).toISOString(),
        Plot: plot.identifier,
        Treatment: plot.treatment,
        Genotype: plot.genotype,
        Block: plot.block,
        light_intensity: light,
        efficiency: round(0.74 - light / 2800 - stress + (random() - 0.5) * 0.05, 3),
        stress_index: round(0.7 + light / 800 + line + stress * 4 + (random() - 0.5) * 0.3, 2),
      });
    });
  }
  return rows;
}

const PLOT_READINGS_TABLE: FixtureTable = {
  identifier: "3b8d2f61-7c4e-4a9b-8e15-6d0f2a9c4b72",
  displayName: "Leaf measurements",
  columns: [
    dataColumn("timestamp", "TIMESTAMP"),
    dataColumn("Plot", "STRING"),
    dataColumn("Treatment", "STRING"),
    dataColumn("Genotype", "STRING"),
    dataColumn("Block", "STRING"),
    dataColumn("light_intensity", "DOUBLE"),
    dataColumn("efficiency", "DOUBLE"),
    dataColumn("stress_index", "DOUBLE"),
  ],
  rows: plotReadingRows(),
  defaultSortColumn: "timestamp",
};

async function dataRoute(): Promise<string> {
  return `/platform/experiments/${await resolve(DROUGHT_TRIAL)}/data`;
}

const plotColumns: TicketShot = {
  slug: "c7-plot-columns",
  route: dataRoute,
  fixtures: [new FixtureWarehouse(DROUGHT_TRIAL, [PLOT_READINGS_TABLE]), noSheetsFixture],
  viewport: VIEWPORT,
  prepare: async (page) => {
    const table = page.locator("table").first();
    await table.getByText("Severe drought").first().waitFor();

    const headers = ["Plot", "Treatment", "Genotype", "Block"].map((name) =>
      table.getByRole("columnheader", { name }),
    );
    const cells = table.locator("tbody tr").last().locator("td");
    const firstHeaderIndex = await headers[0].evaluate((header) =>
      header instanceof HTMLTableCellElement ? header.cellIndex : -1,
    );
    const blockColumn = [
      ...headers,
      cells.nth(firstHeaderIndex),
      cells.nth(firstHeaderIndex + headers.length - 1),
    ];

    const marker = new ChangeMarker(page);
    await marker.mark(blockColumn, "New", "above");
    return marker.frame([page.getByRole("tab", { name: "Data", exact: true }), table], 16);
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Before the placement the shot starts on 4 May.
const ONBOARDED_AT = "2026-04-28T09:00:00.000Z";
const AMBYTE_ID = "8d1f4c2a-6b3e-4f7a-9c5d-2e8b1a0f3c64";

/**
 * The drought trial has a handheld onboarded but no Ambyte, so a gateway is added to the list,
 * onboarded the same way as the handheld. Both carry neutral serials in place of the seed's, and
 * the warehouse the local stack cannot reach reads as loaded, so no load warning shows.
 */
const onboardedDevicesFixture = new FixtureTransform(
  (url) => /^\/api\/v1\/experiments\/[^/]+\/devices$/.test(url.pathname),
  (_url, body) => {
    if (!isRecord(body) || !Array.isArray(body.devices)) return body;
    const handheld: unknown = body.devices[0];
    if (!isRecord(handheld) || !isRecord(handheld.device) || !isRecord(handheld.binding)) {
      return body;
    }

    const binding = { ...handheld.binding, addedAt: ONBOARDED_AT };
    const ambyte = {
      ...handheld,
      clientId: "amb-0117",
      binding,
      device: {
        ...handheld.device,
        id: AMBYTE_ID,
        thingName: "amb-0117",
        serialNumber: "AMB-0117",
        name: "Ambyte Field Gateway 01",
        deviceType: "ambyte",
      },
    };
    const multispeq = {
      ...handheld,
      clientId: "mq-0342",
      binding,
      device: { ...handheld.device, thingName: "mq-0342", serialNumber: "MQ-0342" },
    };
    const others: unknown[] = body.devices.slice(1);
    return {
      ...body,
      devices: [ambyte, multispeq, ...others],
      pipelineUnavailable: false,
    };
  },
);

async function devicesRoute(): Promise<string> {
  return `/platform/experiments/${await resolve(DROUGHT_TRIAL)}/devices`;
}

async function openAmbyte(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: /Ambyte Field Gateway 01/ })
    .first()
    .click();
  await page.getByRole("heading", { name: "Ambyte Field Gateway 01" }).waitFor();
  // The measurement chart reads the warehouse, and its header would be cut by the crop.
  await hideElements([card(page.getByText("Measurements in this experiment"))]);
}

/** The Ambits the Ambyte's readings name, as the sensor resolver reports them. */
const ambyteSensors = new ExperimentPath(`devices/${AMBYTE_ID}/sensors`, [
  { sensorId: "AMT-1021", label: "Ambit 1" },
  { sensorId: "AMT-1022", label: "Ambit 2" },
  { sensorId: "AMT-1023", label: "Ambit 3" },
  { sensorId: "AMT-1024", label: "Ambit 4" },
]);

const placeSensor: TicketShot = {
  slug: "c9-place-sensor",
  route: devicesRoute,
  fixtures: [exampleLayoutFixture, onboardedDevicesFixture, ambyteSensors, noPlacements],
  viewport: VIEWPORT,
  prepare: async (page) => {
    await openAmbyte(page);

    // CSS, since the open dialog hides the rest of the page from role queries.
    const placeButton = page.locator("button", { hasText: "Place on plot" });
    await placeButton.click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();

    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Ambit 2 (AMT-1022)", exact: true }).click();

    await dialog.getByRole("combobox", { name: "Plot" }).click();
    await page.getByPlaceholder("Search plots").fill("C4");
    await page.getByRole("option", { name: "C4", exact: true }).click();

    await dialog.getByRole("button", { name: "Start date" }).click();
    const calendar = page.locator("[data-radix-popper-content-wrapper]");
    for (let step = 0; step < 12; step++) {
      if (await calendar.getByText("May 2026").isVisible()) break;
      await calendar.getByRole("button", { name: /previous month/i }).click();
    }
    await calendar.getByRole("gridcell", { name: "4", exact: true }).first().click();
    await calendar.waitFor({ state: "hidden" });
    await page.mouse.move(0, 0);

    const content = page.locator("[role=dialog]", { hasText: "Place on plot" });
    const marker = new ChangeMarker(page);
    await marker.mark(content, "New", "above");
    await outline(page, placeButton);
    const heading = page.locator("h2", { hasText: /^Devices$/ });
    const listedAmbyte = page.locator("button", { hasText: "Ambyte Field Gateway 01" });
    const detachButton = page.locator("button", { hasText: "Detach" });
    return marker.frame([heading, content, placeButton, detachButton, listedAmbyte], 24);
  },
};

function plotId(identifier: string): string {
  const plot = examplePlots().find((candidate) => candidate.identifier === identifier);
  if (plot === undefined) throw new Error(`No plot ${identifier} in the example field`);
  return plot.id;
}

const ambytePlacements = new ExperimentPath("layout/placements", [
  {
    id: "0b6f1c2d-4e5a-4b7c-8d9e-1f2a3b4c5d6e",
    deviceId: AMBYTE_ID,
    sensorId: "AMT-1022",
    plotId: plotId("C4"),
    startDate: "2026-05-04",
    endDate: null,
  },
  {
    id: "1c7a2d3e-5f6b-4c8d-9e0f-2a3b4c5d6e7f",
    deviceId: AMBYTE_ID,
    sensorId: "AMT-1021",
    plotId: plotId("B6"),
    startDate: "2026-05-04",
    endDate: "2026-06-30",
  },
]);

const placedSensor: TicketShot = {
  slug: "c9-placed-sensor",
  route: devicesRoute,
  fixtures: [exampleLayoutFixture, onboardedDevicesFixture, ambyteSensors, ambytePlacements],
  viewport: VIEWPORT,
  prepare: async (page) => {
    await openAmbyte(page);
    const placements = page.locator("[data-device-placements]");
    await placements.getByText("Ambit 2 on Plot C4").waitFor();
    await page.mouse.move(0, 0);

    const marker = new ChangeMarker(page);
    await marker.mark(placements, "New", "above");
    const heading = page.locator("h2", { hasText: /^Devices$/ });
    const listedAmbyte = page.locator("button", { hasText: "Ambyte Field Gateway 01" });
    const detail = page.getByRole("heading", { name: "Ambyte Field Gateway 01" });
    return marker.frame([heading, listedAmbyte, detail, placements], 24);
  },
};

/** A breeder's code for the nth plot of the example field, in row then column order. */
function breederCode(index: number): string {
  return `DT26-${String(index + 1).padStart(3, "0")}`;
}

/** The plot whose sheet row repeats the position before it, F4, so it goes to Unplaced. */
const CLASHING_PLOT = "F5";

/**
 * The example field as a breeder's pasted list with row and column, where F6 to F8 have no
 * position yet and F5's row gives F4's position by mistake.
 */
function plotListSheet(): string {
  const lines = ["plot\trow\tcolumn"];
  for (const [index, plot] of examplePlots().entries()) {
    const isUnplaced = plot.row === FIELD_ROWS && plot.column >= 6;
    const column = plot.identifier === CLASHING_PLOT ? plot.column - 1 : plot.column;
    lines.push(
      isUnplaced
        ? `${breederCode(index)}\t\t`
        : `${breederCode(index)}\t${rowLetter(plot.row)}\t${column}`,
    );
  }
  return lines.join("\n");
}

const pastePlots: TicketShot = {
  slug: "c11-paste-plots",
  route: () => layoutRoute(),
  fixtures: [noLayout],
  viewport: { width: VIEWPORT.width, height: 1100 },
  prepare: async (page) => {
    await page.getByRole("button", { name: "Define layout" }).click();
    await page.getByRole("button", { name: "Paste a plot list" }).click();
    const dialog = page.locator("[role=dialog]", { hasText: "Paste a plot list" });
    await dialog.getByText("Paste or upload a sheet").waitFor();
    await pasteText(page, plotListSheet());
    const preview = page.locator("[data-plot-list-preview]");
    await preview.waitFor();
    await page.mouse.move(0, 0);

    const marker = new ChangeMarker(page);
    await marker.mark(
      [page.locator("[data-plot-list-mapping]"), preview],
      "New",
      "inside-top-right",
    );
    return marker.frame([dialog], 16);
  },
};

const UNPLACED = new Set([CLASHING_PLOT, "F6", "F7", "F8"]);

const unplacedLayout = exampleLayoutWith({
  naming: null,
  units: exampleFieldLayout().units.map((unit, index) => {
    const named = { ...unit, identifier: breederCode(index) };
    return UNPLACED.has(unit.identifier) ? { ...named, row: null, column: null } : named;
  }),
});

const unplacedStrip: TicketShot = {
  slug: "c11-unplaced",
  route: () => layoutRoute(),
  fixtures: [unplacedLayout],
  viewport: { width: VIEWPORT.width, height: 1100 },
  prepare: async (page) => {
    const strip = page.locator("[data-unplaced-strip]");
    await strip.waitFor();
    await hideToolbar(page);
    await page.mouse.move(0, 0);

    const marker = new ChangeMarker(page);
    await marker.mark(strip, "New", "inside-right");
    await outline(page, setupSummary(page).getByText("From a pasted list"));
    return marker.frame(
      [layoutTab(page), viewSwitch(page), setupSummary(page), plotGrid(page)],
      24,
    );
  },
};

const MEASURED_PLOT = "C5";

const measuredLayout = exampleLayoutWith({
  readingCount: 3,
  units: exampleFieldLayout().units.map((unit) =>
    unit.identifier === MEASURED_PLOT ? { ...unit, readingCount: 3 } : unit,
  ),
});

/** Drags from one position to another with the mouse, the way a researcher paints. */
async function paint(page: Page, from: string, to: string): Promise<void> {
  const start = await page.getByRole("button", { name: from, exact: true }).boundingBox();
  const end = await page.getByRole("button", { name: to, exact: true }).boundingBox();
  if (start === null || end === null) throw new Error(`Cannot paint from ${from} to ${to}`);
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 8 });
  await page.mouse.up();
}

async function paintGaps(page: Page): Promise<void> {
  await plotGrid(page).waitFor();
  await toolbarControl(page, "markGaps").click();
  await page.locator("[data-gap-banner]").waitFor();
  await paint(page, "E8", "F8");
  await paint(page, MEASURED_PLOT, MEASURED_PLOT);
  await page.getByText("3 changes").waitFor();
}

const markGaps: TicketShot = {
  slug: "c12-mark-gaps",
  route: () => layoutRoute(),
  fixtures: [measuredLayout],
  viewport: VIEWPORT,
  prepare: async (page) => {
    await paintGaps(page);
    await page.mouse.move(0, 0);

    const banner = page.locator("[data-gap-banner]");
    const marker = new ChangeMarker(page);
    await marker.mark(banner, "New", "below");
    for (const identifier of ["E8", "F8", MEASURED_PLOT]) {
      await outline(page, page.getByRole("button", { name: identifier, exact: true }));
    }
    return marker.frame(
      [layoutTab(page), viewSwitch(page), setupSummary(page), plotGrid(page)],
      24,
    );
  },
};

const removeConfirm: TicketShot = {
  slug: "c12-remove-confirm",
  route: () => layoutRoute(),
  fixtures: [measuredLayout],
  viewport: VIEWPORT,
  prepare: async (page) => {
    await paintGaps(page);
    await page.getByRole("button", { name: "Done", exact: true }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.waitFor();
    await page.mouse.move(0, 0);

    const marker = new ChangeMarker(page);
    await marker.mark(dialog, "New", "above");
    return marker.frame([dialog], 40);
  },
};

const plotAttributesFixture = new ExperimentPath("layout/attributes", {
  names: ["Treatment", "Genotype", "Block"],
  plots: examplePlots().map((plot) => ({
    unitId: plot.id,
    values: { Treatment: plot.treatment, Genotype: plot.genotype, Block: plot.block },
  })),
});

const colorBy: TicketShot = {
  slug: "c13-color-by",
  route: () => layoutRoute(),
  fixtures: [exampleLayoutFixture, plotAttributesFixture],
  viewport: VIEWPORT,
  prepare: async (page) => {
    const select = page.locator("[data-color-by]");
    await select.waitFor();
    await hideToolbar(page);
    await page.mouse.move(0, 0);

    const grid = plotGrid(page);
    const marker = new ChangeMarker(page);
    await marker.mark(grid, "New", "below");
    await outline(page, select);
    return marker.frame([layoutTab(page), viewSwitch(page), setupSummary(page), grid], 24);
  },
};

/** A workbook that asks for the plot as a question, beside two other questions and a measurement. */
const plotQuestionFlow = new ExperimentPath("flow", {
  id: "6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
  experimentId: "6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4e",
  graph: {
    nodes: [
      { id: "question-plot", type: "question", name: "Plot", content: {}, isStart: true },
      { id: "question-leaf", type: "question", name: "Leaf position", content: {}, isStart: false },
      { id: "measurement", type: "measurement", name: "Leaf reading", content: {}, isStart: false },
      { id: "question-notes", type: "question", name: "Notes", content: {}, isStart: false },
    ],
    edges: [],
  },
  createdAt: "2026-04-20T09:00:00.000Z",
  updatedAt: "2026-04-20T09:00:00.000Z",
});

const plotQuestion: TicketShot = {
  slug: "c14-plot-question",
  route: () => layoutRoute(),
  fixtures: [noLayout, plotQuestionFlow],
  viewport: VIEWPORT,
  prepare: async (page) => {
    await page.getByRole("button", { name: "Define layout" }).click();
    await page.getByRole("button", { name: "Create 48 plots" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText("Which question names the plot?").waitFor();
    await page.mouse.move(0, 0);

    const marker = new ChangeMarker(page);
    await marker.mark(dialog, "New", "above");
    return marker.frame([dialog], 40);
  },
};

export const SHOTS_C: readonly TicketShot[] = [
  plotsView,
  firstRun,
  defineLayout,
  viewNeedsPlots,
  plotLegend,
  loadError,
  plotInspector,
  levelTerm,
  geoAnchor,
  sheetByPlot,
  addAttributes,
  plotColumns,
  placeSensor,
  placedSensor,
  pastePlots,
  unplacedStrip,
  markGaps,
  removeConfirm,
  colorBy,
  plotQuestion,
];
