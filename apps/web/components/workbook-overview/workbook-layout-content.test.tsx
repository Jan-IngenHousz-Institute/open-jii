import { AutosaveStatusProvider } from "@/components/shared/autosave/autosave-status-context";
import { createWorkbook, createWorkbookVersionSummary } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { WorkbookLayoutContent } from "./workbook-layout-content";

describe("WorkbookLayoutContent", () => {
  const workbook = createWorkbook({
    id: "wb-1",
    name: "Photosynthesis Lab",
    createdBy: "user-1",
    createdByName: "Test User",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1", name: "Test User", email: "test@test.com" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    // Default: an unpublished workbook (no versions). Tests that need a
    // published version re-mount the handler.
    server.mount(contract.workbooks.listWorkbookVersions, { body: [] });
  });

  function renderContent(overrides: Partial<typeof workbook> = {}) {
    return render(
      <AutosaveStatusProvider>
        <WorkbookLayoutContent id="wb-1" workbook={{ ...workbook, ...overrides }}>
          <div data-testid="children">Notebook goes here</div>
        </WorkbookLayoutContent>
      </AutosaveStatusProvider>,
    );
  }

  it("displays the workbook title, metadata, and save indicator", () => {
    renderContent();
    expect(screen.getByText("Photosynthesis Lab")).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
    // Indicator now reads from the unified autosave context; default
    // (no edits reported) is "all saved".
    expect(screen.getByText("autosave.saved")).toBeInTheDocument();
  });

  it("renders children content", () => {
    renderContent();
    expect(screen.getByTestId("children")).toBeInTheDocument();
  });

  it("lets the creator rename the workbook by clicking the title", async () => {
    const user = userEvent.setup();
    const updateSpy = server.mount(contract.workbooks.updateWorkbook, {
      body: createWorkbook({ ...workbook, name: "Soil Analysis" }),
    });

    renderContent();

    await user.click(screen.getByText("Photosynthesis Lab"));

    const input = screen.getByDisplayValue("Photosynthesis Lab");
    await user.clear(input);
    await user.type(input, "Soil Analysis");

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(updateSpy.body).toEqual({ name: "Soil Analysis" });
    });
  });

  it("shows a dash when createdByName is null", () => {
    renderContent({ createdByName: undefined });
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("shows the latest published version number", async () => {
    server.mount(contract.workbooks.listWorkbookVersions, {
      body: [
        createWorkbookVersionSummary({ workbookId: "wb-1", version: 3 }),
        createWorkbookVersionSummary({ workbookId: "wb-1", version: 2 }),
      ],
    });

    renderContent();

    expect(await screen.findByText("v3")).toBeInTheDocument();
  });

  it("shows a draft label when the workbook has no published versions", async () => {
    renderContent();
    expect(await screen.findByText("workbooks.draftVersion")).toBeInTheDocument();
  });

  it("falls back to a dash (not 'Draft') when the versions fetch fails", async () => {
    server.mount(contract.workbooks.listWorkbookVersions, { status: 500 });

    renderContent({ createdByName: "Test User" });

    // The version cell shows "-" rather than wrongly claiming the workbook is a draft.
    expect(await screen.findByText("-")).toBeInTheDocument();
    expect(screen.queryByText("workbooks.draftVersion")).not.toBeInTheDocument();
  });
});
