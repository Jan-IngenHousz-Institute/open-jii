import type { Locator, Page } from "@playwright/test";

import type { ColumnTerm } from "@repo/api/domains/experiment/columns/experiment-columns.schema";
import type { StudyRecord } from "@repo/api/domains/experiment/study/experiment-study.schema";

import { experimentId } from "../docs-media/seed-entities.js";
import type { Box } from "./change-marker.js";
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

const DRAFT_TRIAL: Resolvable = () => experimentId("Draft trial (example data)");

async function draftOverviewRoute(): Promise<string> {
  return `/platform/experiments/${await resolve(DRAFT_TRIAL)}`;
}

async function blurFocus(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
}

/** The readiness block and the funding row belong to other tickets, so A1's screens leave them out. */
async function hideOtherChanges(page: Page): Promise<void> {
  await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll("h4, p"));
    const readiness = labels.find((label) => label.textContent === "Standards readiness");
    readiness?.parentElement?.remove();
    const funding = labels.find((label) => label.textContent === "Funding");
    funding?.parentElement?.remove();
  });
}

/** The tag sits below the section, so the next section is nudged down to leave it room. */
async function markStudySection(page: Page): Promise<Box> {
  const section = studySection(page);
  const cardHeading = page.getByRole("heading", { name: "Details", exact: true });
  await section.evaluate((element) => {
    element.style.marginBottom = "32px";
  });

  const marker = new ChangeMarker(page);
  await marker.mark(section, "New", "below");
  return marker.frame([cardHeading, section], 24);
}

// NCBI Taxonomy and ENVO terms as the Ontology Lookup Service gives them, checked on 9 November 2026.
const GLYCINE_MAX: ColumnTerm = {
  id: "NCBITaxon:3847",
  label: "Glycine max",
  vocabulary: "NCBI Taxonomy",
  iri: "http://purl.obolibrary.org/obo/NCBITaxon_3847",
};
const AGRICULTURAL_FIELD: ColumnTerm = {
  id: "ENVO:00000114",
  label: "agricultural field",
  vocabulary: "Environment Ontology (ENVO)",
  iri: "http://purl.obolibrary.org/obo/ENVO_00000114",
  definition:
    "A field which is located on land and used for agricultural purposes, such as the grazing of livestock or the cultivation of crops.",
};

/** The drought trial's subjects and related work, which the scaffold reads from its own route. */
export const EXAMPLE_STUDY_RECORD: StudyRecord = {
  subjects: [
    { label: "Glycine max", term: GLYCINE_MAX },
    { label: "agricultural field", term: AGRICULTURAL_FIELD },
    { label: "drought stress", term: null },
  ],
  relatedWork: [{ identifier: "10.5072/example-paper", relationType: "IsDescribedBy" }],
};

/** Answers the study record route, which has no backend yet, for one experiment. */
export class ExampleStudyRecord implements Fixture {
  constructor(
    private readonly experiment: Resolvable,
    private readonly record: StudyRecord,
  ) {}

  async install(page: Page): Promise<void> {
    const path = `/api/v1/experiments/${await resolve(this.experiment)}/study-record`;
    await page.route(
      (url) => url.pathname === path,
      (route) => route.fulfill({ status: 200, json: this.record }),
    );
  }
}

/** A term search that matches nothing, so the picker offers the typed words as a keyword. */
class NoMatchingTerms implements Fixture {
  async install(page: Page): Promise<void> {
    await page.route(
      (url) => url.pathname === "/api/v1/column-terms/search",
      (route) => route.fulfill({ status: 200, json: { terms: [] } }),
    );
  }
}

export const droughtTrialStudyRecord = new ExampleStudyRecord(DROUGHT_TRIAL, EXAMPLE_STUDY_RECORD);

export async function waitForStudyRecord(scope: Page | Locator): Promise<void> {
  await scope.getByText(GLYCINE_MAX.id).first().waitFor();
}

const studyDetailsOnOverview: TicketShot = {
  slug: "a1-study-details",
  route: overviewRoute,
  fixtures: [droughtTrialStudyRecord],
  viewport: { width: 1440, height: 1000 },
  prepare: async (page) => {
    await waitForStudyRecord(page);
    await hideOtherChanges(page);
    return markStudySection(page);
  },
};

const studyDetailsNotSet: TicketShot = {
  slug: "a1-study-details-not-set",
  route: draftOverviewRoute,
  fixtures: [new ExampleStudyRecord(DRAFT_TRIAL, { subjects: [], relatedWork: [] })],
  viewport: { width: 1440, height: 1000 },
  prepare: async (page) => {
    await page.getByRole("heading", { name: "Study details", exact: true }).waitFor();
    await page.waitForLoadState("networkidle");
    await hideOtherChanges(page);
    return markStudySection(page);
  },
};

async function openStudyDialog(page: Page): Promise<Locator> {
  await waitForStudyRecord(page);
  await studySection(page).getByRole("button", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog");
  await waitForStudyRecord(dialog);
  return dialog;
}

const studyDetailsDialog: TicketShot = {
  slug: "a1-study-details-dialog",
  route: overviewRoute,
  fixtures: [droughtTrialStudyRecord],
  viewport: { width: 1440, height: 1200 },
  prepare: async (page) => {
    const dialog = await openStudyDialog(page);

    // The Funding section is A2's change, so A1's dialog is shown without it.
    await dialog.getByRole("region", { name: "Funding" }).evaluate((section) => section.remove());
    await blurFocus(page);

    const marker = new ChangeMarker(page);
    return marker.frame([dialog], 16);
  },
};

const discardChanges: TicketShot = {
  slug: "a1-discard-changes",
  route: overviewRoute,
  fixtures: [droughtTrialStudyRecord, new NoMatchingTerms()],
  viewport: { width: 1440, height: 1200 },
  prepare: async (page) => {
    const dialog = await openStudyDialog(page);

    await dialog.getByRole("region", { name: "Funding" }).evaluate((section) => section.remove());
    await dialog.getByRole("button", { name: "Add a subject" }).click();
    await page.getByPlaceholder("Search terms, or type a keyword").fill("soil moisture");
    await page.getByRole("option", { name: /as a keyword/ }).click();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    const prompt = page.getByRole("alertdialog");
    await prompt.waitFor();

    // The prompt hides the dialog from the accessibility tree, so the dialog is found by its markup.
    const behind = page.locator('[role="dialog"]');
    const marker = new ChangeMarker(page);
    await marker.mark(prompt, "New", "inside-top-right");
    return marker.frame([behind, prompt], 16);
  },
};

export const STUDY_METADATA_SHOTS: readonly TicketShot[] = [
  studyDetailsOnOverview,
  studyDetailsNotSet,
  studyDetailsDialog,
  discardChanges,
];
