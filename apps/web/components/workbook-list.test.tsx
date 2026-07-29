import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { Workbook } from "@repo/api/domains/workbook/workbook.schema";
import { toast } from "@repo/ui/hooks/use-toast";

import { WorkbookList } from "./workbook-list";

function makeWorkbook(overrides: Partial<Workbook> & Pick<Workbook, "id" | "name">): Workbook {
  return {
    description: null,
    cells: [],
    metadata: {},
    createdBy: "00000000-0000-0000-0000-0000000000aa",
    createdByName: "Tester",
    forkedFrom: null,
    organizationId: null,
    visibility: "public",
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

describe("WorkbookList delete affordance", () => {
  const unused = makeWorkbook({
    id: "11111111-1111-1111-1111-111111111111",
    name: "Unused WB",
    experimentCount: 0,
  });

  beforeEach(() => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(false);
  });

  it("shows a docs help link in the empty state when showEmptyHelp is set", () => {
    render(<WorkbookList workbooks={[]} showEmptyHelp />);
    expect(screen.getByRole("link").getAttribute("href")).toContain("/guide/experiments/workbooks");
  });

  it("never offers Delete on a row, even for an unused workbook", async () => {
    // Lists include other people's public and shared workbooks, and a
    // row has no capability signal (they are detail-only, to avoid a `can()` per
    // row) — so it cannot tell a manager from a plain reader. Deletion moved to
    // the detail surface, gated on `can(manage)`.
    const user = userEvent.setup();
    render(<WorkbookList workbooks={[unused]} />);
    expect(await deleteAvailableFor(user, "Unused WB")).toBe(false);
  });

  it("still offers Delete when the deletion flag is on", async () => {
    // The flag never re-adds the row action; it only governs the in-use case on
    // the detail surface.
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
    const user = userEvent.setup();
    render(<WorkbookList workbooks={[unused]} />);
    expect(await deleteAvailableFor(user, "Unused WB")).toBe(false);
  });
});

describe("WorkbookList row actions", () => {
  const unused = makeWorkbook({
    id: "33333333-3333-3333-3333-333333333333",
    name: "Source WB",
    description: "desc",
    experimentCount: 0,
  });

  beforeEach(() => {
    vi.mocked(useFeatureFlagEnabled).mockReturnValue(true);
  });

  it("duplicates a workbook from the row menu", async () => {
    const spy = server.mount(contract.workbooks.createWorkbook, {
      status: 201,
      body: makeWorkbook({ id: "99999999-9999-9999-9999-999999999999", name: "Copy of Source WB" }),
    });
    const user = userEvent.setup();
    render(<WorkbookList workbooks={[unused]} />);

    const row = screen.getByText("Source WB").closest("tr");
    if (!row) throw new Error("row not found");
    await user.click(within(row).getByLabelText("workbooks.actions.more"));
    await user.click(await screen.findByRole("menuitem", { name: "workbooks.actions.fork" }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toMatchObject({ name: "Fork of Source WB" });
  });

  it("shows an error toast when duplicate fails", async () => {
    server.mount(contract.workbooks.createWorkbook, { status: 500 });
    const user = userEvent.setup();
    render(<WorkbookList workbooks={[unused]} />);

    const row = screen.getByText("Source WB").closest("tr");
    if (!row) throw new Error("row not found");
    await user.click(within(row).getByLabelText("workbooks.actions.more"));
    await user.click(await screen.findByRole("menuitem", { name: "workbooks.actions.fork" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
  });
});
