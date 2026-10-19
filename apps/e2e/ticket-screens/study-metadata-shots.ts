import type { Page } from "@playwright/test";

import { experimentId } from "../docs-media/seed-entities.js";
import { ChangeMarker } from "./change-marker.js";
import type { Fixture, Resolvable } from "./fixture.js";
import { resolve } from "./fixture.js";
import type { TicketShot } from "./shots.js";

// study-metadata-example-data.sql creates this example; the overview renders on the server.
const DROUGHT_TRIAL: Resolvable = () => experimentId("Drought trial (example data)");

async function overviewRoute(): Promise<string> {
  return `/platform/experiments/${await resolve(DROUGHT_TRIAL)}`;
}

function studySection(page: Page) {
  return page.getByRole("heading", { name: "Study details", exact: true }).locator("xpath=../..");
}

const studyDetailsOnOverview: TicketShot = {
  slug: "a1-study-details",
  route: overviewRoute,
  prepare: async (page) => {
    await page.getByText("Glycine max").waitFor();
    const readiness = page
      .getByRole("heading", { name: "Standards readiness", exact: true })
      .locator("xpath=..");
    const idHeading = page.getByRole("heading", { name: "Experiment ID", exact: true });

    const marker = new ChangeMarker(page);
    await marker.mark([studySection(page), readiness], "New", "inside-right");
    return marker.frame([idHeading, readiness], 24);
  },
};

const studyDetailsDialog: TicketShot = {
  slug: "a1-study-details-dialog",
  route: overviewRoute,
  prepare: async (page) => {
    await page.getByText("Glycine max").waitFor();
    await studySection(page).getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();

    const marker = new ChangeMarker(page);
    return marker.frame([dialog], 16);
  },
};

const FIELD_ROWS = 6;
const FIELD_COLUMNS = 8;
const FIELD_GAPS = new Set(["B4", "E7"]);

function rowLetter(row: number): string {
  return String.fromCharCode(64 + row);
}

function exampleUnitId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

/** A six by eight field with two gaps, which no table holds yet, so the layout route is answered here. */
function exampleFieldLayout() {
  const units = [];
  for (let row = 1; row <= FIELD_ROWS; row++) {
    for (let column = 1; column <= FIELD_COLUMNS; column++) {
      const identifier = `${rowLetter(row)}${column}`;
      if (!FIELD_GAPS.has(identifier)) {
        units.push({
          id: exampleUnitId(units.length + 1),
          parentId: null,
          identifier,
          row,
          column,
          active: true,
        });
      }
    }
  }
  return { levelName: "Plot", rows: FIELD_ROWS, columns: FIELD_COLUMNS, units };
}

const exampleLayout: Fixture = {
  install: async (page) => {
    await page.route(
      (url) => /^\/api\/v1\/experiments\/[^/]+\/layout$/.test(url.pathname),
      (route) => route.fulfill({ status: 200, json: exampleFieldLayout() }),
    );
  },
};

const layoutTab: TicketShot = {
  slug: "c2-layout-grid",
  route: async () => `/platform/experiments/${await resolve(DROUGHT_TRIAL)}/layout`,
  fixtures: [exampleLayout],
  viewport: { width: 1440, height: 1000 },
  prepare: async (page) => {
    await page.getByText("Plot grid").waitFor();
    const tab = page.getByRole("tab", { name: "Layout" });
    const setup = page.getByText("Set up the layout").locator("xpath=ancestor::div[contains(@class,'rounded')][1]");
    const grid = page.getByText("Plot grid").locator("xpath=ancestor::div[contains(@class,'rounded')][1]");

    const marker = new ChangeMarker(page);
    await marker.mark(tab, "New", "above");
    await marker.mark([setup, grid], "New", "below");
    return marker.frame([tab, setup, grid], 24);
  },
};

export const STUDY_METADATA_SHOTS: readonly TicketShot[] = [
  studyDetailsOnOverview,
  studyDetailsDialog,
  layoutTab,
];
