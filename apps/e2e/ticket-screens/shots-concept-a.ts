import type { Locator, Page } from "@playwright/test";

import type {
  ColumnDescription,
  ColumnDictionary,
  ColumnTerm,
  DictionaryColumn,
} from "@repo/api/domains/experiment/columns/experiment-columns.schema";

import { ChangeMarker } from "./change-marker.js";
import type { Fixture } from "./fixture.js";
import {
  miappeFields,
  noLinkedWorkbook,
  overviewRoute,
  readiness,
  trialTables,
} from "./shots-b.js";
import type { TicketShot } from "./shots.js";

const MACRO_ID = "00000000-0000-4000-8000-0000000000a5";
const READING = "Sensor reading taken with each measurement";
const DAILY_MEAN = "Mean of one day's readings for one plot";

function described(trait: string, traitTerm: ColumnTerm | null, method: string): ColumnDescription {
  return { trait, traitTerm, method, methodTerm: null, scale: null, scaleTerm: null, unit: null };
}

function column(
  table: string,
  name: string,
  description: ColumnDescription | null,
): DictionaryColumn {
  return { identity: `${table}:${name}`, name, type: "DOUBLE", rowCount: 1240, description };
}

// The a5 dictionary's seven columns: four described, one of those with a Crop Ontology term, so
// the step lines name the same columns the readiness counts.
const DICTIONARY: ColumnDictionary = {
  groups: [
    {
      producer: { kind: "instrument", workbookVersion: 4 },
      columns: [
        column(
          "raw_data",
          "leaf_temperature",
          described(
            "Leaf temperature",
            { id: "CO_336:0000561", label: "Leaf temperature" },
            READING,
          ),
        ),
        column("raw_data", "light_intensity", described("Light intensity", null, READING)),
        column("raw_data", "relative_humidity", null),
        column("raw_data", "plot", null),
      ],
    },
    {
      producer: { kind: "macro", macroId: MACRO_ID, macroName: "Daily means" },
      columns: [
        column(
          MACRO_ID,
          "daily_mean_temperature",
          described("Daily mean leaf temperature", null, DAILY_MEAN),
        ),
        column(
          MACRO_ID,
          "daily_mean_light",
          described("Daily mean light intensity", null, DAILY_MEAN),
        ),
        column(MACRO_ID, "quality_flag", null),
      ],
    },
  ],
};

const columnDictionary: Fixture = {
  install: async (page) => {
    await page.route(
      (url) => /^\/api\/v1\/experiments\/[^/]+\/columns$/.test(url.pathname),
      (route) => route.fulfill({ status: 200, json: DICTIONARY }),
    );
  },
};

/**
 * The harness hides every link ending in /datasets so B's shots show no Datasets tab, which would
 * also hide the publish step's button. The tab stays hidden.
 */
const keepPublishButton: Fixture = {
  install: async (page) => {
    await page.addInitScript(() => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(
        '#standards-readiness a[href$="/datasets"] { display: inline-flex !important; }',
      );
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    });
  },
};

const FIXTURES: readonly Fixture[] = [
  trialTables,
  readiness,
  miappeFields,
  noLinkedWorkbook,
  columnDictionary,
  keepPublishButton,
];

async function conceptRoute(): Promise<string> {
  return `${await overviewRoute()}?readiness=a`;
}

function conceptSection(page: Page) {
  return page.locator("#standards-readiness");
}

/** Waits for the concept, the details card and the dictionary's column names to be in place. */
async function openConcept(page: Page): Promise<Locator> {
  const section = conceptSection(page);
  await section.getByText("Get this trial ready to share").waitFor();
  await section.getByText("relative_humidity, plot, quality_flag").waitFor();
  await page.getByText("Glycine max").waitFor();
  return section;
}

/** Radix marks the page outside an open sheet aria-hidden, so the tab strip is found by CSS. */
function tabStrip(page: Page) {
  return page.locator("[role='tablist']").first();
}

/** The details card's header spans the card, so framing it keeps the card beside the concept. */
function detailsHeader(page: Page) {
  return page.getByRole("heading", { name: "Details", exact: true }).locator("xpath=..");
}

async function blurFocus(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
}

/** Waits out an opening slide, which would otherwise skew the outline drawn around the sheet. */
async function settled(element: Locator): Promise<void> {
  await element.evaluate((node) =>
    Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  );
}

const conceptOverview: TicketShot = {
  slug: "b8-concept-a-overview",
  route: conceptRoute,
  fixtures: FIXTURES,
  viewport: { width: 1440, height: 2000 },
  prepare: async (page) => {
    const section = await openConcept(page);

    const marker = new ChangeMarker(page);
    await marker.mark(section, "Concept A", "above");
    return marker.frame([tabStrip(page), section, detailsHeader(page)], 24);
  },
};

const conceptDetail: TicketShot = {
  slug: "b8-concept-a-detail",
  route: conceptRoute,
  fixtures: FIXTURES,
  // Only as tall as the concept needs, since the sheet runs the full height of the viewport.
  viewport: { width: 1440, height: 1300 },
  prepare: async (page) => {
    const section = await openConcept(page);
    // Found by CSS, since the open sheet hides the page from role queries.
    const chip = section.locator("button", { hasText: "Phenotyping repositories, 4 fields" });
    await chip.click();

    const sheet = page.locator("[role='dialog']", { hasText: "14 of 22 fields filled" });
    await sheet.getByText("Describe columns").first().waitFor();
    await settled(sheet);
    await blurFocus(page);

    // The sheet covers the right of the concept, so the outline goes round the chip that opened it.
    const marker = new ChangeMarker(page);
    await marker.mark(chip, "Concept A", "outside-left");
    return marker.frame([tabStrip(page), section, sheet], 24);
  },
};

export const SHOTS_CONCEPT_A: readonly TicketShot[] = [conceptOverview, conceptDetail];
