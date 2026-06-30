import { createMarkdownCell, createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { use } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";
import { useSession } from "@repo/auth/client";
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
  vi.mocked(useSession).mockReturnValue({
    data: { user: { id: "user-1" } },
    isPending: false,
  } as ReturnType<typeof useSession>);
  // Pickers fetch lists at mount even when their popovers stay closed.
  server.mount(orpcContract.protocols.listProtocols, { body: [] });
  server.mount(orpcContract.macros.listMacros, { body: [] });
});

function renderPage() {
  return render(<WorkbookOverviewPage params={Promise.resolve({ id: "wb-1" })} />);
}

describe("WorkbookOverviewPage", () => {
  it("shows the loading text before the workbook arrives", () => {
    server.mount(orpcContract.workbooks.getWorkbook, {
      body: createWorkbook({ id: "wb-1" }),
    });
    renderPage();
    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("renders an error display when the fetch fails", async () => {
    server.mount(orpcContract.workbooks.getWorkbook, { status: 500 });
    renderPage();
    await waitFor(() => expect(screen.getByText("workbooks.errorLoading")).toBeInTheDocument());
  });

  it("renders the workbook's cells in the editor once data loads", async () => {
    server.mount(orpcContract.workbooks.getWorkbook, {
      body: createWorkbook({
        id: "wb-1",
        name: "Hello",
        cells: [createMarkdownCell({ id: "md-1", content: "<p>cell body</p>" })],
      }),
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText("Markdown").length).toBeGreaterThan(0);
    });
    expect(screen.queryByText("Empty workbook")).not.toBeInTheDocument();
  });

  it("auto-saves cells (debounced) when the user adds a cell", async () => {
    const user = userEvent.setup();

    server.mount(orpcContract.workbooks.getWorkbook, {
      body: createWorkbook({ id: "wb-1", cells: [] }),
    });
    const updateSpy = server.mount(orpcContract.workbooks.updateWorkbook, {
      body: createWorkbook({ id: "wb-1" }),
    });

    renderPage();

    const markdownBtn = await screen.findByRole("button", { name: /markdown/i });
    await user.click(markdownBtn);

    // Auto-save fires after AUTO_SAVE_DELAY=1500ms; give waitFor headroom.
    await waitFor(() => expect(updateSpy.callCount).toBeGreaterThan(0), { timeout: 3000 });

    const savedCells = (updateSpy.body as { cells: { type: string }[] } | undefined)?.cells;
    expect(savedCells).toHaveLength(1);
    expect(savedCells?.[0].type).toBe("markdown");
  });

  it("shows a destructive toast when auto-save fails", async () => {
    const user = userEvent.setup();

    server.mount(orpcContract.workbooks.getWorkbook, {
      body: createWorkbook({ id: "wb-1", cells: [] }),
    });
    server.mount(orpcContract.workbooks.updateWorkbook, { status: 400 });

    renderPage();

    const markdownBtn = await screen.findByRole("button", { name: /markdown/i });
    await user.click(markdownBtn);

    await waitFor(
      () => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
      { timeout: 3000 },
    );
  });

  it("hides add-cell controls when the viewer is not the workbook creator", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "someone-else" } },
      isPending: false,
    } as ReturnType<typeof useSession>);

    server.mount(orpcContract.workbooks.getWorkbook, {
      body: createWorkbook({ id: "wb-1", createdBy: "user-1", cells: [] }),
    });

    renderPage();

    await waitFor(() => expect(screen.queryByText("common.loading")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /markdown/i })).not.toBeInTheDocument();
  });
});
