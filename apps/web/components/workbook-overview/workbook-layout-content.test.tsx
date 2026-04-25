import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { WorkbookLayoutContent } from "./workbook-layout-content";
import { WorkbookSaveProvider } from "./workbook-save-context";

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
  });

  function renderContent(overrides: Partial<typeof workbook> = {}) {
    return render(
      <WorkbookSaveProvider>
        <WorkbookLayoutContent id="wb-1" workbook={{ ...workbook, ...overrides }}>
          <div data-testid="children">Notebook goes here</div>
        </WorkbookLayoutContent>
      </WorkbookSaveProvider>,
    );
  }

  it("displays the workbook title, metadata, and save indicator", () => {
    renderContent();
    expect(screen.getByText("Photosynthesis Lab")).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("workbooks.allChangesSaved")).toBeInTheDocument();
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

    // Click the title to enter edit mode
    await user.click(screen.getByText("Photosynthesis Lab"));

    // Clear and type new name
    const input = screen.getByDisplayValue("Photosynthesis Lab");
    await user.clear(input);
    await user.type(input, "Soil Analysis");

    // Click the Save button (check icon)
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(updateSpy.body).toEqual({ name: "Soil Analysis" });
    });
  });

  it("shows a dash when createdByName is null", () => {
    renderContent({ createdByName: undefined });
    expect(screen.getByText("-")).toBeInTheDocument();
  });
});
