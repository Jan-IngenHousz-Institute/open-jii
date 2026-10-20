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
import { DROUGHT_TRIAL_TABLE } from "./fixture-tables.js";
import { FixtureTransform } from "./fixture-transform.js";
import { FixtureWarehouse } from "./fixture-warehouse.js";
import type { Fixture, Resolvable } from "./fixture.js";
import { resolve } from "./fixture.js";
import type { TicketShot } from "./shots.js";

const DROUGHT_TRIAL: Resolvable = () => experimentId("Drought trial (example data)");
const VIEWPORT = { width: 1440, height: 1000 };
const PLOT_MAP_SHEET = "Plot map";

async function layoutRoute(): Promise<string> {
  return `/platform/experiments/${await resolve(DROUGHT_TRIAL)}/layout`;
}

function layoutTab(page: Page): Locator {
  return page.getByRole("tab", { name: "Layout" });
}

function card(locator: Locator): Locator {
  return locator.locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
}

// C3, C4 and C5 each build on C2 alone and may land in any order, so each of their shots hides the
// other two tickets' controls below. The components keep rendering all three for other projects.

function plotSearch(page: Page): Locator {
  return page.getByPlaceholder("Find by name").locator("xpath=ancestor::form[1]");
}

function anchorButton(page: Page): Locator {
  return page.getByRole("button", { name: "Anchor on map" });
}

function termField(page: Page): Locator {
  return page.locator("label", { hasText: /^Term$/ }).locator("xpath=..");
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

function plotAttributes(plot: ExamplePlot) {
  return [
    { name: "Treatment", value: plot.treatment, source: { type: "sheet", sheetName: PLOT_MAP_SHEET } },
    { name: "Genotype", value: plot.genotype, source: { type: "edit", sheetName: PLOT_MAP_SHEET } },
    { name: "Block", value: plot.block, source: { type: "layout" } },
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
  route: layoutRoute,
  fixtures: [exampleLayoutFixture, plotInspectorFixture],
  viewport: VIEWPORT,
  prepare: async (page) => {
    await page.getByText("Plot grid").waitFor();
    await hideElements([termField(page), anchorButton(page)]);

    const cell = page.getByRole("button", { name: "C4", exact: true });
    await cell.click();
    await page.getByText('From the sheet "Plot map", edited after upload').waitFor();
    await page.mouse.move(0, 0);

    const setup = card(page.getByText("Set up the layout"));
    const grid = card(page.getByText("Plot grid"));
    const panel = card(page.getByText("Plot C4", { exact: true }));

    const marker = new ChangeMarker(page);
    await marker.mark(panel, "New", "above");
    await outline(page, cell);
    await outline(page, plotSearch(page));
    return marker.frame([layoutTab(page), setup, grid, panel], 24);
  },
};

const LAYOUT_PATH = /^\/api\/v1\/experiments\/[^/]+\/layout$/;

/** Answers the layout route with the example field and a change no table can hold yet. */
function exampleLayoutWith(changes: Record<string, unknown>): Fixture {
  return {
    install: async (page) => {
      await page.route(
        (url) => LAYOUT_PATH.test(url.pathname),
        (route) => route.fulfill({ status: 200, json: { ...exampleFieldLayout(), ...changes } }),
      );
    },
  };
}

const CGO = "https://www.tno.nl/agrifood/ontology/common-greenhouse-ontology#";

/** Classes from the published Common Greenhouse Ontology v1.3 that name a place a crop stands. */
const GREENHOUSE_TERMS = [
  { id: "cgo:Bench", label: "Bench", iri: `${CGO}Bench` },
  { id: "cgo:Compartment", label: "Compartment", iri: `${CGO}Compartment` },
  { id: "cgo:DrainCollectionTray", label: "Drain Collection Tray", iri: `${CGO}DrainCollectionTray` },
  { id: "cgo:Zone", label: "Greenhouse Zone", iri: `${CGO}Zone` },
];

/** Answers the term search by matching labels, as the ontology lookup would. */
const termSearchFixture: Fixture = {
  install: async (page) => {
    await page.route(
      (url) => url.pathname === "/api/v1/layout/terms/search",
      (route) => {
        const query = (new URL(route.request().url()).searchParams.get("query") ?? "").toLowerCase();
        const matches = GREENHOUSE_TERMS.filter((term) => term.label.toLowerCase().includes(query));
        return route.fulfill({ status: 200, json: matches });
      },
    );
  },
};

const levelTerm: TicketShot = {
  slug: "c4-level-term",
  route: layoutRoute,
  fixtures: [exampleLayoutWith({ levelName: "Tray" }), termSearchFixture],
  viewport: VIEWPORT,
  prepare: async (page) => {
    await page.getByText("Tray grid").waitFor();
    // The row holding Find by name and Anchor on map, hidden whole so the grid sits as C2 drew it.
    await hideElements([plotSearch(page).locator("xpath=..")]);

    await page.getByRole("combobox", { name: "Term", exact: true }).click();
    await page.getByPlaceholder("Search the Common Greenhouse Ontology").fill("tray");
    await page.getByText("Drain Collection Tray").waitFor();
    await page.mouse.move(0, 0);

    // The open list covers the top of this line, and what shows below it would read as a cut line.
    await page.getByText(/^Identifiers run from/).evaluate((element) => {
      if (element instanceof HTMLElement) {
        element.style.visibility = "hidden";
      }
    });

    const setup = card(page.getByText("Set up the layout"));
    const grid = card(page.getByText("Tray grid"));
    const list = page.locator("[data-radix-popper-content-wrapper]");

    const marker = new ChangeMarker(page);
    await marker.mark([termField(page), list], "New", "inside-right");
    return marker.frame([layoutTab(page), setup, grid], 24);
  },
};

async function waitForTiles(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const tiles = Array.from(document.querySelectorAll(".leaflet-tile"));
    return tiles.length > 0 && tiles.every((tile) => tile.classList.contains("leaflet-tile-loaded"));
  });
}

const geoAnchor: TicketShot = {
  slug: "c5-geo-anchor",
  route: layoutRoute,
  fixtures: [
    exampleLayoutWith({
      anchor: { latitude: 52.0, longitude: 5.1, bearing: 30, plotWidth: 2, plotLength: 3 },
    }),
  ],
  // Taller than the others, so the anchor card holds the plot size and the map unscrolled.
  viewport: { width: VIEWPORT.width, height: 1200 },
  prepare: async (page) => {
    await page.getByText("Plot grid").waitFor();
    await hideElements([plotSearch(page), termField(page)]);

    await anchorButton(page).click();
    await waitForTiles(page);
    // Typed, since the contract's anchor carries no plot size for a fixture to answer with.
    await page.getByLabel("Width (m)").fill("2.0");
    const length = page.getByLabel("Length (m)");
    await length.fill("3.0");
    await length.blur();
    await page.locator(".leaflet-marker-icon").first().click();
    await page.locator(".leaflet-popup").getByText("A1 corner").waitFor();
    await page.mouse.move(0, 0);

    const setup = card(page.getByText("Set up the layout"));
    const grid = card(page.getByText("Plot grid"));
    const anchor = card(page.getByText("Anchor on map", { exact: true }).last());

    const marker = new ChangeMarker(page);
    await marker.mark(anchor, "New", "above");
    await outline(page, anchorButton(page));
    return marker.frame([layoutTab(page), setup, grid, anchor], 24);
  },
};

async function dataRoute(): Promise<string> {
  return `/platform/experiments/${await resolve(DROUGHT_TRIAL)}/data`;
}

/** No sheet is saved yet; the metadata route reads the lakehouse, which the local stack cannot reach. */
const noSheetsFixture: Fixture = {
  install: async (page) => {
    await page.route(
      (url) => /^\/api\/v1\/experiments\/[^/]+\/metadata$/.test(url.pathname),
      (route) => route.fulfill({ status: 200, json: [] }),
    );
  },
};

/** A plot map with one row per grid position, gaps included, as a researcher would paste it. */
function plotMapSheet(): string {
  const lines = ["plot\ttreatment\tgenotype\tblock"];
  for (let row = 1; row <= FIELD_ROWS; row++) {
    for (let column = 1; column <= FIELD_COLUMNS; column++) {
      const genotype = column <= 4 ? "Line A" : "Line B";
      const block = String(Math.ceil(row / 2));
      lines.push(`${rowLetter(row)}${column}\t${TREATMENTS[(row + column) % 3]}\t${genotype}\t${block}`);
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
          typeof body === "object" && body !== null && "identifiers" in body && Array.isArray(body.identifiers)
            ? body.identifiers.map(String)
            : [];
        const seen = new Set<string>();
        const duplicateNames: string[] = [];
        for (const name of identifiers) {
          if (seen.has(name)) duplicateNames.push(name);
          seen.add(name);
        }
        const unmatchedNames = [...seen].filter((name) => !plotNames.has(name));
        const plotsWithoutRow = [...plotNames].filter((name) => !seen.has(name));
        return route.fulfill({
          status: 200,
          json: {
            matchedRowCount: [...seen].filter((name) => plotNames.has(name)).length,
            unmatchedNames,
            duplicateNames,
            plotsWithoutRow,
          },
        });
      },
    );
  },
};

async function pasteText(page: Page, text: string): Promise<void> {
  await page.evaluate((text) => {
    const data = new DataTransfer();
    data.setData("text/plain", text);
    document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data }));
  }, text);
}

const sheetByPlot: TicketShot = {
  slug: "c6-sheet-by-plot",
  route: dataRoute,
  fixtures: [
    new FixtureWarehouse(DROUGHT_TRIAL, [DROUGHT_TRIAL_TABLE]),
    exampleLayoutFixture,
    noSheetsFixture,
    sheetPreviewFixture,
  ],
  // A little taller than the others, so the dialog holds the table, the select and the preview unscrolled.
  viewport: { width: VIEWPORT.width, height: 1080 },
  prepare: async (page) => {
    await page.getByRole("button", { name: "Upload Metadata" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Add new" }).click();
    await dialog.getByText("Import your metadata").waitFor();
    await pasteText(page, plotMapSheet());
    await dialog.getByText("48 rows imported").waitFor();
    await dialog.getByLabel("Name").fill(PLOT_MAP_SHEET);

    await dialog.getByRole("button", { name: "Column options" }).first().click();
    await page.getByRole("menuitem", { name: "Set as identifier" }).click();
    // CSS locators, since an open select hides the rest of the page from role queries.
    const select = page.locator("#metadata-match-target");
    await select.click();
    await page.getByRole("option", { name: "Plot", exact: true }).click();
    const preview = page.locator("[role=dialog] div.rounded-md", { hasText: "46 rows matched" });
    await preview.waitFor();
    await preview.evaluate((element) => element.scrollIntoView({ block: "end" }));

    // Reopened so the Layout group shows above Questions and Measurement columns.
    await select.click();
    const listbox = page.locator("[role=listbox]");
    await listbox.waitFor();
    await page.mouse.move(0, 0);

    const marker = new ChangeMarker(page);
    await marker.mark([listbox, select, preview], "New", "inside-right");
    return marker.frame([page.locator("[role=dialog]", { hasText: "Import Metadata" })], 16);
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
      const stress = plot.treatment === "Severe drought" ? 0.18 : plot.treatment === "Drought" ? 0.1 : 0;
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
    const firstHeaderIndex = await headers[0].evaluate(
      (header) => (header instanceof HTMLTableCellElement ? header.cellIndex : -1),
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

/**
 * The drought trial has a handheld onboarded but no Ambyte, so a gateway is added to the list,
 * onboarded the same way as the handheld. Both carry neutral serials in place of the seed's, and
 * the warehouse the local stack cannot reach reads as loaded, so no load warning shows behind the
 * dialog.
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
        id: "8d1f4c2a-6b3e-4f7a-9c5d-2e8b1a0f3c64",
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
    return {
      ...body,
      devices: [ambyte, multispeq, ...body.devices.slice(1)],
      pipelineUnavailable: false,
    };
  },
);

const placeSensor: TicketShot = {
  slug: "c9-place-sensor",
  route: async () => `/platform/experiments/${await resolve(DROUGHT_TRIAL)}/devices`,
  fixtures: [exampleLayoutFixture, onboardedDevicesFixture],
  viewport: VIEWPORT,
  prepare: async (page) => {
    await page.getByRole("button", { name: /Ambyte Field Gateway 01/ }).first().click();
    await page.getByRole("heading", { name: "Ambyte Field Gateway 01" }).waitFor();
    // The measurement chart reads the warehouse, and the dialog's lower edge would cut its header.
    await hideElements([card(page.getByText("Measurements in this experiment"))]);

    // CSS, since the open dialog hides the rest of the page from role queries.
    const placeButton = page.locator("button", { hasText: "Place on plot" });
    await placeButton.click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();

    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "2 of 4" }).click();

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

export const SHOTS_C: readonly TicketShot[] = [
  plotInspector,
  levelTerm,
  geoAnchor,
  sheetByPlot,
  plotColumns,
  placeSensor,
];
