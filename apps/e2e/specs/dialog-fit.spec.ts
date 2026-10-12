import type { Locator, Page } from "@playwright/test";
import postgres from "postgres";

import {
  cleanupDialogFitExperiment,
  mockLakehouse,
  seedDialogFitExperiment,
} from "../experiment-data-fixtures.js";
import type { LakehouseData } from "../experiment-data-fixtures.js";
import { expect, test } from "../fixtures.js";
import {
  assertSafeFixtureDatabase,
  databaseUrl,
  dismissCookieBanner,
  locale,
  seedEmail,
} from "../helpers.js";

const tag = "dialog-fit";
const questionText = "Which plot is this device stationed at?";
let workbookId: string;
let experimentId: string;

test.setTimeout(90_000);

function connect() {
  return postgres(databaseUrl, { connect_timeout: 2, idle_timeout: 1, max: 1 });
}

async function cleanup(): Promise<void> {
  assertSafeFixtureDatabase();
  const sql = connect();
  try {
    await sql`delete from workbooks where metadata->>'e2e' = ${tag}`;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

test.beforeAll(async () => {
  await cleanup();
  const sql = connect();
  try {
    const seeds = await sql<{ id: string; organization_id: string }[]>`
      select u.id, m.organization_id
      from users u
      join organization_members m on m.user_id = u.id
      where u.email = ${seedEmail}
      order by m.created_at
      limit 1
    `;
    const seed = seeds.at(0);
    if (!seed) throw new Error(`No user and organization found for ${seedEmail}`);
    const cells = [
      {
        id: crypto.randomUUID(),
        name: "plot",
        type: "question",
        question: {
          kind: "multi_choice",
          text: questionText,
          options: Array.from({ length: 60 }, (_, i) => `Plot ${i + 1}`),
          required: true,
        },
        isAnswered: false,
        isCollapsed: false,
      },
    ];
    const rows = await sql<{ id: string }[]>`
      insert into workbooks (name, description, cells, metadata, created_by, organization_id)
      values (
        '[E2E] Dialog fit', 'Fixture for dialog fit E2E coverage', ${sql.json(cells)},
        ${sql.json({ e2e: tag })}, ${seed.id}, ${seed.organization_id}
      )
      returning id
    `;
    const row = rows.at(0);
    if (!row) throw new Error("Failed to create the dialog-fit workbook");
    workbookId = row.id;
  } finally {
    await sql.end({ timeout: 1 });
  }
  experimentId = await seedDialogFitExperiment();
});

test.afterAll(async () => {
  await cleanup();
  await cleanupDialogFitExperiment();
});

async function openWorkbook(page: Page): Promise<void> {
  await page.goto(`/${locale}/platform/workbooks/${workbookId}`, { waitUntil: "networkidle" });
  await dismissCookieBanner(page);
}

async function openExperimentData(page: Page, data: LakehouseData): Promise<void> {
  await mockLakehouse(page, experimentId, data);
  await page.goto(`/${locale}/platform/experiments/${experimentId}/data`, {
    waitUntil: "networkidle",
  });
  await dismissCookieBanner(page);
}

// In the viewport is not enough: a list that overflows its box can paint over a button.
async function expectReachable(locator: Locator): Promise<void> {
  await expect(locator).toBeInViewport({ ratio: 1 });
  await expect
    .poll(() =>
      locator.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return hit !== null && element.contains(hit);
      }),
    )
    .toBe(true);
}

// A zoomed browser is a smaller CSS viewport at a higher device scale factor.
const screens = [
  { name: "1440x900", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  { name: "1920x1080 at 200% zoom", viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 },
  { name: "phone landscape", viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 },
];

for (const screen of screens) {
  test.describe(screen.name, () => {
    test.use({ viewport: screen.viewport, deviceScaleFactor: screen.deviceScaleFactor });

    test("pasting many bulk options keeps the dialog actions on screen", async ({ page }) => {
      await openWorkbook(page);
      await page.getByRole("button", { name: "Bulk Add" }).first().click();

      const dialog = page.getByRole("dialog", { name: "Bulk Add Answer Options" });
      await dialog
        .getByRole("textbox")
        .fill(Array.from({ length: 120 }, (_, i) => `Plot ${i + 1}`).join("\n"));

      await expect(dialog.getByRole("heading")).toBeInViewport({ ratio: 1 });
      await expect(dialog.getByRole("button", { name: "Add Options" })).toBeInViewport({
        ratio: 1,
      });
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).not.toBeVisible();
    });

    test("answering a question with many options keeps submit on screen", async ({ page }) => {
      await openWorkbook(page);
      await page.getByRole("button", { name: "Run Question" }).first().click();

      const dialog = page.getByRole("dialog", { name: questionText });
      await expect(dialog.getByRole("heading")).toBeInViewport({ ratio: 1 });
      await expect(dialog.getByRole("button", { name: "Submit" })).toBeInViewport({ ratio: 1 });

      const lastOption = dialog.getByRole("button", { name: "Plot 60", exact: true });
      await lastOption.scrollIntoViewIfNeeded();
      await lastOption.click();
      await expect(dialog.getByRole("button", { name: "Submit" })).toBeInViewport({ ratio: 1 });
      await expect(dialog.getByRole("button", { name: "Submit" })).toBeEnabled();
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).not.toBeVisible();
    });

    test("a long upload history keeps the upload actions reachable", async ({ page }) => {
      await openExperimentData(page, { uploads: 7 });
      await page.getByRole("button", { name: "Upload Data" }).click();

      const dialog = page.getByRole("dialog", { name: "Upload data" });
      await expect(dialog.getByText("Upload #1")).toBeAttached();
      await expectReachable(dialog.getByRole("heading", { name: "Upload data" }));
      await expectReachable(dialog.getByRole("button", { name: "Close" }).first());
      await expectReachable(dialog.getByRole("button", { name: "New upload" }));

      const oldestUpload = dialog.getByText("Upload #1");
      await oldestUpload.scrollIntoViewIfNeeded();
      await expectReachable(oldestUpload);

      await dialog.getByRole("button", { name: "New upload" }).click();
      await page.getByRole("menuitem", { name: "CSV" }).click();
      await expectReachable(dialog.getByRole("heading", { name: "Upload data" }));
      await expectReachable(dialog.getByRole("button", { name: "Upload", exact: true }));
      await dialog.getByRole("button", { name: "Back" }).click();
      await expectReachable(dialog.getByRole("button", { name: "New upload" }));
    });

    test("many metadata records keep the metadata actions reachable", async ({ page }) => {
      await openExperimentData(page, { metadata: 8 });
      await page.getByRole("button", { name: "Edit Metadata" }).click();

      const dialog = page.getByRole("dialog", { name: "Import Metadata" });
      await expect(dialog.getByText("Plot layout 8")).toBeAttached();
      await expectReachable(dialog.getByRole("heading", { name: "Import Metadata" }));
      await expectReachable(dialog.getByRole("button", { name: "Back" }));
      await expectReachable(dialog.getByRole("button", { name: "Add new" }));

      const lastRecord = dialog.getByText("Plot layout 8");
      await lastRecord.scrollIntoViewIfNeeded();
      await expectReachable(lastRecord);
    });

    test("many exports keep the export actions reachable", async ({ page }) => {
      await openExperimentData(page, { withTable: true, exports: 8 });
      await page.getByRole("button", { name: "Download table" }).click();

      const dialog = page.getByRole("dialog", { name: "Export Dataset" });
      await expect(dialog.getByText("Export #1", { exact: true })).toBeAttached();
      await expectReachable(dialog.getByRole("heading", { name: "Export Dataset" }));
      await expectReachable(dialog.getByRole("button", { name: "Close" }).first());
      await expectReachable(dialog.getByRole("button", { name: "Create Export" }));

      const oldestExport = dialog.getByText("Export #1", { exact: true });
      await oldestExport.scrollIntoViewIfNeeded();
      await expectReachable(oldestExport);
    });
  });
}
