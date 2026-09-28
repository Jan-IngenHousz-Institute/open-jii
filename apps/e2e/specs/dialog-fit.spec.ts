import type { Page } from "@playwright/test";
import postgres from "postgres";

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
});

test.afterAll(cleanup);

async function openWorkbook(page: Page): Promise<void> {
  await page.goto(`/${locale}/platform/workbooks/${workbookId}`, { waitUntil: "networkidle" });
  await dismissCookieBanner(page);
}

// A zoomed browser is a smaller CSS viewport at a higher device scale factor.
const screens = [
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
  });
}
