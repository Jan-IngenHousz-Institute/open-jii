import { render, screen, userEvent, within } from "@/test/test-utils";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Workbook } from "@repo/api/schemas/workbook.schema";

import { WorkbookList } from "./workbook-list";

function makeWorkbook(overrides: Partial<Workbook> & Pick<Workbook, "id" | "name">): Workbook {
  return {
    description: null,
    cells: [],
    metadata: {},
    createdBy: "00000000-0000-0000-0000-0000000000aa",
    createdByName: "Tester",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

async function deleteAvailableFor(user: ReturnType<typeof userEvent.setup>, name: string) {
  const row = screen.getByText(name).closest("tr");
  if (!row) throw new Error(`row not found for ${name}`);
  await user.click(within(row).getByLabelText("workbooks.actions.more"));
  // Wait for the menu to open (Open is always present), then probe for Delete.
  await screen.findByRole("menuitem", { name: "workbooks.actions.open" });
  const hasDelete = screen.queryByRole("menuitem", { name: "workbooks.actions.delete" }) !== null;
  await user.keyboard("{Escape}");
  return hasDelete;
}

describe("WorkbookList delete gating (workbook-deletion flag)", () => {
  const unused = makeWorkbook({
    id: "11111111-1111-1111-1111-111111111111",
    name: "Unused WB",
    experimentCount: 0,
  });
  const inUse = makeWorkbook({
    id: "22222222-2222-2222-2222-222222222222",
    name: "Attached WB",
    experimentCount: 2,
  });

  beforeEach(() => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(false);
  });

  it("hides Delete for an in-use workbook when the flag is off", async () => {
    const user = userEvent.setup();
    render(<WorkbookList workbooks={[inUse]} />);
    expect(await deleteAvailableFor(user, "Attached WB")).toBe(false);
  });

  it("keeps Delete for an unused workbook even when the flag is off", async () => {
    const user = userEvent.setup();
    render(<WorkbookList workbooks={[unused]} />);
    expect(await deleteAvailableFor(user, "Unused WB")).toBe(true);
  });

  it("shows Delete for an in-use workbook when the flag is on", async () => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
    const user = userEvent.setup();
    render(<WorkbookList workbooks={[inUse]} />);
    expect(await deleteAvailableFor(user, "Attached WB")).toBe(true);
  });
});
