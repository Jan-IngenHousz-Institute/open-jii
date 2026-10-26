import type { Locator, Page } from "@playwright/test";

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

const studyDetailsOnOverview: TicketShot = {
  slug: "a1-study-details",
  route: overviewRoute,
  viewport: { width: 1440, height: 1000 },
  prepare: async (page) => {
    await page.getByText("Glycine max").waitFor();
    await hideOtherChanges(page);
    return markStudySection(page);
  },
};

const studyDetailsNotSet: TicketShot = {
  slug: "a1-study-details-not-set",
  route: draftOverviewRoute,
  viewport: { width: 1440, height: 1000 },
  prepare: async (page) => {
    await page.getByRole("heading", { name: "Study details", exact: true }).waitFor();
    await hideOtherChanges(page);
    return markStudySection(page);
  },
};

/** NCBI Taxonomy's answer for soybean, since the scaffold's organism search has no backend. */
class SoybeanTaxonomy implements Fixture {
  async install(page: Page): Promise<void> {
    await page.route(
      (url) => url.pathname === "/api/v1/organisms/search",
      (route) =>
        route.fulfill({
          status: 200,
          json: {
            organisms: [
              { taxonId: "3847", name: "Glycine max", commonName: "soybean" },
              { taxonId: "3848", name: "Glycine soja", commonName: "wild soybean" },
            ],
          },
        }),
    );
  }
}

async function chooseOrganism(page: Page, dialog: Locator, name: string): Promise<void> {
  await dialog.getByRole("combobox").filter({ hasText: "Glycine max" }).click();
  await page.getByPlaceholder("Scientific or common name").fill("soybean");
  await page.getByRole("option", { name: new RegExp(name) }).click();
}

/** The seeded facility predates the type, so the shots give it one and a description. */
async function setOpenField(page: Page, dialog: Locator): Promise<void> {
  await dialog.getByRole("combobox").filter({ hasText: "Not set" }).click();
  await page.getByRole("option", { name: "Open field" }).click();
  await dialog.getByPlaceholder("e.g. Greenhouse 2, compartment 3").fill("Field 4, north block");
}

const studyDetailsDialog: TicketShot = {
  slug: "a1-study-details-dialog",
  route: overviewRoute,
  fixtures: [new SoybeanTaxonomy()],
  viewport: { width: 1440, height: 1000 },
  prepare: async (page) => {
    await page.getByText("Glycine max").waitFor();
    await studySection(page).getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();

    // The Funding section is A2's change, so A1's dialog is shown without it.
    await dialog.getByRole("region", { name: "Funding" }).evaluate((section) => section.remove());

    await chooseOrganism(page, dialog, "Glycine max");
    await setOpenField(page, dialog);
    await blurFocus(page);

    const marker = new ChangeMarker(page);
    return marker.frame([dialog], 16);
  },
};

const discardChanges: TicketShot = {
  slug: "a1-discard-changes",
  route: overviewRoute,
  fixtures: [new SoybeanTaxonomy()],
  viewport: { width: 1440, height: 1000 },
  prepare: async (page) => {
    await page.getByText("Glycine max").waitFor();
    await studySection(page).getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();

    await dialog.getByRole("region", { name: "Funding" }).evaluate((section) => section.remove());
    await setOpenField(page, dialog);
    await chooseOrganism(page, dialog, "Glycine soja");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    const prompt = page.getByRole("alertdialog");
    await prompt.waitFor();

    // The prompt hides the dialog from the accessibility tree, so the dialog is found by its markup.
    const behind = page.locator('[role="dialog"]');
    const marker = new ChangeMarker(page);
    await marker.mark(prompt, "New", "above");
    return marker.frame([behind, prompt], 16);
  },
};

export const STUDY_METADATA_SHOTS: readonly TicketShot[] = [
  studyDetailsOnOverview,
  studyDetailsNotSet,
  studyDetailsDialog,
  discardChanges,
];
