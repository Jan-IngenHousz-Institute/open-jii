import type { Locator, Page } from "@playwright/test";

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

const TAG = "Concept D";

// F's dataset fixtures are not exported, so the draft is mirrored here. The trial has published
// nothing yet, which is B's fifth gap, so its one dataset is an unpublished version 1.
const DRAFT_ID = "00000000-0000-4000-9000-0000000000d1";

const AUTHORS = [
  {
    userId: "00000000-0000-4000-a000-000000000001",
    givenName: "Seed",
    familyName: "User",
    orcid: "0000-0002-1825-0097",
    affiliation: "Example University",
  },
  {
    userId: "00000000-0000-4000-a000-000000000002",
    givenName: "Alex",
    familyName: "Example",
    orcid: null,
    affiliation: "Example University",
  },
  {
    userId: "00000000-0000-4000-a000-000000000003",
    givenName: "Robin",
    familyName: "Example",
    orcid: null,
    affiliation: "Example University",
  },
];

function draftVersionOne(experiment: string) {
  return {
    id: DRAFT_ID,
    experimentId: experiment,
    version: 1,
    state: "draft",
    title: "Drought trial, 2026 season (example data)",
    description:
      "Soybean lines under three irrigation treatments, measured weekly through the season.",
    limitations: null,
    authors: AUTHORS,
    license: null,
    access: "open",
    embargoUntil: null,
    funding: [{ funderName: "Example Research Council", awardNumber: "EX-2026-001" }],
    relatedPublications: [],
    excludedReadings: [],
    doi: null,
    deposit: null,
    supersedesId: null,
    files: [],
    createdAt: "2026-09-28T09:00:00.000Z",
    publishedAt: null,
    withdrawnAt: null,
    withdrawalReason: null,
  };
}

/** Answers fixed paths, some of which carry the experiment's id, which is looked up per run. */
function pathsFixture(build: (experiment: string) => Record<string, unknown>): Fixture {
  return {
    install: async (page) => {
      const bodies = new Map(Object.entries(build(await resolve(DROUGHT_TRIAL))));
      await page.route(
        (url) => bodies.has(url.pathname),
        (route) => {
          const pathname = new URL(route.request().url()).pathname;
          return route.fulfill({ status: 200, json: bodies.get(pathname) });
        },
      );
    },
  };
}

const draftList = pathsFixture((experiment) => ({
  [`/api/v1/experiments/${experiment}/datasets`]: [draftVersionOne(experiment)],
}));

// The floor is complete because the draft carries its authors and funding and the trial its
// license. Concept D does not show F's per-standard verdicts, so none are answered.
const publishFlow = pathsFixture((experiment) => ({
  [`/api/v1/datasets/${DRAFT_ID}`]: draftVersionOne(experiment),
  [`/api/v1/datasets/${DRAFT_ID}/scope`]: {
    version: 1,
    readingCount: 966,
    countedAt: "2026-10-20T09:00:00.000Z",
  },
  [`/api/v1/datasets/${DRAFT_ID}/flagged-readings`]: [],
  [`/api/v1/datasets/${DRAFT_ID}/readiness`]: {
    floor: {
      filled: ["title", "creators", "publisher", "year", "type", "license", "access", "funding"],
      missing: [],
    },
    standards: [],
  },
}));

const overviewFixtures = [trialTables, readiness, miappeFields, noLinkedWorkbook];

async function overviewWithConcept(): Promise<string> {
  return `${await overviewRoute()}?readiness=d`;
}

async function datasetsWithConcept(): Promise<string> {
  return `${await overviewRoute()}/datasets?readiness=d`;
}

async function publishWithConcept(): Promise<string> {
  return `${await overviewRoute()}/datasets/${DRAFT_ID}/publish?readiness=d`;
}

/** Found by CSS, since an open dialog hides the page from role queries. */
function tabStrip(page: Page): Locator {
  return page.locator("[role='tablist']").first();
}

/** The details card beside the concept, so the crop spans the whole Overview. */
function detailsCard(page: Page): Locator {
  return page
    .locator("h3", { hasText: /^Details$/ })
    .locator("xpath=ancestor::div[contains(concat(' ', @class, ' '), ' rounded-xl ')][1]");
}

function conceptSection(page: Page): Locator {
  return page.locator("#standards-readiness");
}

/** Waits out an opening zoom, which would otherwise skew the outline drawn around a part of it. */
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

async function waitForOverview(page: Page): Promise<Locator> {
  const section = conceptSection(page);
  await section.getByText("Waits for the 4 steps above").waitFor();
  await page.getByText("Glycine max").waitFor();
  return section;
}

const overviewShot: TicketShot = {
  slug: "b8-concept-d-overview",
  route: overviewWithConcept,
  fixtures: overviewFixtures,
  viewport: { width: 1440, height: 1700 },
  prepare: async (page) => {
    const section = await waitForOverview(page);

    const marker = new ChangeMarker(page);
    await marker.mark(section, TAG, "above");
    return marker.frame([tabStrip(page), detailsCard(page), section], 24);
  },
};

const chooseShot: TicketShot = {
  slug: "b8-concept-d-choose",
  route: overviewWithConcept,
  fixtures: overviewFixtures,
  viewport: { width: 1440, height: 1700 },
  prepare: async (page) => {
    const section = await waitForOverview(page);
    await section.getByRole("button", { name: "Change", exact: true }).click();

    const dialog = page.locator("[role='dialog']", { hasText: "What this trial follows" });
    await dialog.getByText("Not offered yet").waitFor();
    await settled(dialog);
    await blurFocus(page);

    const marker = new ChangeMarker(page);
    await marker.mark(dialog, TAG, "above");
    return marker.frame([tabStrip(page), detailsCard(page), section, dialog], 24);
  },
};

const gateShot: TicketShot = {
  slug: "f5-concept-d-gate",
  route: datasetsWithConcept,
  fixtures: [draftList, readiness, miappeFields],
  viewport: { width: 1440, height: 1000 },
  prepare: async (page) => {
    const banner = page.getByTestId("publish-gate");
    await banner.getByText("Publishing waits for 4 steps").waitFor();
    const list = page.getByTestId("experiment-datasets");

    const marker = new ChangeMarker(page);
    await marker.mark(banner, TAG, "above");
    return marker.frame([tabStrip(page), banner, list], 24);
  },
};

function nextButton(page: Page): Locator {
  return page.getByRole("button", { name: "Next", exact: true });
}

/** Goes forward through the flow with Next, as a researcher would, ticking what a step needs. */
async function goToStep(page: Page, stepTitle: string): Promise<void> {
  await page.getByText("What this dataset will hold").waitFor();
  for (;;) {
    const current = await page.locator("[aria-current='step']").innerText();
    if (current.includes(stepTitle)) return;
    if (current.includes("License and access")) {
      await page.getByRole("checkbox").check();
    }
    await nextButton(page).click();
    await page.waitForTimeout(300);
  }
}

const checkShot: TicketShot = {
  slug: "f5-concept-d-check",
  route: publishWithConcept,
  fixtures: [publishFlow, readiness, miappeFields],
  viewport: { width: 1440, height: 1500 },
  prepare: async (page) => {
    await goToStep(page, "Check");
    const check = page.getByTestId("followed-standards-check");
    await check.getByText("4 steps left").waitFor();

    // Next stays on Check and says why, which is the block.
    await nextButton(page).click();
    await check.getByText("before freezing the dataset").waitFor();
    await blurFocus(page);

    const marker = new ChangeMarker(page);
    await marker.mark(check, TAG, "outside-left");
    return marker.frame([tabStrip(page), check, nextButton(page)], 24);
  },
};

export const SHOTS_CONCEPT_D: readonly TicketShot[] = [
  overviewShot,
  chooseShot,
  gateShot,
  checkShot,
];
