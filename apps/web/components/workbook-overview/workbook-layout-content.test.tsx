import { AutosaveStatusProvider } from "@/components/shared/autosave/autosave-status-context";
import { createWorkbook, createWorkbookDetail, readOnlyCapabilities } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { WorkbookLayoutContent } from "./workbook-layout-content";

describe("WorkbookLayoutContent", () => {
  const workbook = createWorkbookDetail({
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

  it("displays the workbook title and save indicator", () => {
    renderContent();
    expect(screen.getByText("Photosynthesis Lab")).toBeInTheDocument();
    // Indicator now reads from the unified autosave context; default
    // (no edits reported) is "all saved".
    expect(screen.getByText("autosave.saved")).toBeInTheDocument();
  });

  it("renders children content", () => {
    renderContent();
    expect(screen.getByTestId("children")).toBeInTheDocument();
  });

  it("keeps only the title above the tab strip", () => {
    renderContent({ description: "Measures photosynthetic efficiency" });

    // Description, provenance and the fork action belong to the Overview route,
    // so switching to Collaborators leaves them behind rather than hiding them.
    expect(screen.queryByText("Measures photosynthetic efficiency")).not.toBeInTheDocument();
    expect(screen.queryByText("workbooks.descriptionTitle")).not.toBeInTheDocument();
    expect(screen.queryByText("Test User")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "workbooks.actions.fork" }),
    ).not.toBeInTheDocument();
  });

  it("links the Overview and Collaborators routes under the title", () => {
    renderContent();

    expect(screen.getByRole("tab", { name: "common.overview" })).toHaveAttribute(
      "href",
      "/en-US/platform/workbooks/wb-1",
    );
    expect(screen.getByRole("tab", { name: "sharing.collaboratorsTab" })).toHaveAttribute(
      "href",
      "/en-US/platform/workbooks/wb-1/collaborators",
    );
  });

  it("renders no tab strip for a reader who can neither share nor leave", () => {
    renderContent({ capabilities: readOnlyCapabilities });

    expect(screen.getByTestId("children")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
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
      expect(updateSpy.body).toEqual({ name: "Soil Analysis", expectedRevision: 1 });
    });
  });
});
