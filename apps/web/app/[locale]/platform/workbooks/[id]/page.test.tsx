import { createMarkdownCell, createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { use } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import WorkbookOverviewPage from "./page";

vi.mock("@/components/workbook/workbook-code-editor", () => ({
  WorkbookCodeEditor: ({ value }: { value: string }) => (
    <pre data-testid="code-editor">{value}</pre>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(use).mockReturnValue({ id: "wb-1" });
  // Pickers fetch lists at mount even when their popovers stay closed.
  server.mount(contract.protocols.listProtocols, { body: [] });
  server.mount(contract.macros.listMacros, { body: [] });
});

function renderPage() {
  return render(<WorkbookOverviewPage params={Promise.resolve({ id: "wb-1" })} />);
}

describe("WorkbookOverviewPage", () => {
  it("shows the loading text before the workbook arrives", () => {
    server.mount(contract.workbooks.getWorkbook, {
      body: createWorkbook({ id: "wb-1" }),
    });
    renderPage();
    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("renders an error display when the fetch fails", async () => {
    server.mount(contract.workbooks.getWorkbook, { status: 500 });
    renderPage();
    await waitFor(() => expect(screen.getByText("workbooks.errorLoading")).toBeInTheDocument());
  });

  it("renders the workbook's cells in the editor once data loads", async () => {
    server.mount(contract.workbooks.getWorkbook, {
      body: createWorkbook({
        id: "wb-1",
        name: "Hello",
        cells: [createMarkdownCell({ id: "md-1", content: "<p>cell body</p>" })],
      }),
    });
    renderPage();

    // The editor renders the markdown cell's CellWrapper with a "Markdown" label.
    await waitFor(() => {
      expect(screen.getAllByText("Markdown").length).toBeGreaterThan(0);
    });
    // No empty state visible.
    expect(screen.queryByText("Empty workbook")).not.toBeInTheDocument();
  });

  it("auto-saves cells (debounced) when the user adds a cell", async () => {
    const user = userEvent.setup();

    server.mount(contract.workbooks.getWorkbook, {
      body: createWorkbook({ id: "wb-1", cells: [] }),
    });
    const updateSpy = server.mount(contract.workbooks.updateWorkbook, {
      body: createWorkbook({ id: "wb-1" }),
    });

    renderPage();

    const markdownBtn = await screen.findByRole("button", { name: /markdown/i });
    await user.click(markdownBtn);

    // Auto-save fires after AUTO_SAVE_DELAY=1500ms — give waitFor headroom.
    await waitFor(() => expect(updateSpy.callCount).toBeGreaterThan(0), { timeout: 3000 });

    const savedCells = (updateSpy.body as { cells: { type: string }[] } | undefined)?.cells;
    expect(savedCells).toHaveLength(1);
    expect(savedCells?.[0].type).toBe("markdown");
  });

  it("shows a destructive toast when auto-save fails", async () => {
    const user = userEvent.setup();

    server.mount(contract.workbooks.getWorkbook, {
      body: createWorkbook({ id: "wb-1", cells: [] }),
    });
    server.mount(contract.workbooks.updateWorkbook, { status: 400 });

    renderPage();

    const markdownBtn = await screen.findByRole("button", { name: /markdown/i });
    await user.click(markdownBtn);

    await waitFor(
      () => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
      { timeout: 3000 },
    );
  });
});
