import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";
import { useSession } from "@repo/auth/client";

import { WorkbookDetailsSidebar } from "./workbook-details-sidebar";

describe("WorkbookDetailsSidebar", () => {
  const workbook = createWorkbook({
    id: "wb-123",
    name: "Photosynthesis Lab",
    createdBy: "user-1",
    createdByName: "Test User",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Authenticated as the workbook creator
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1", name: "Test User", email: "test@test.com" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
  });

  it("displays workbook metadata: ID and creator name", () => {
    render(<WorkbookDetailsSidebar workbookId="wb-123" workbook={workbook} />);
    expect(screen.getByText("wb-123")).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("shows the delete button when the current user is the creator", () => {
    render(<WorkbookDetailsSidebar workbookId="wb-123" workbook={workbook} />);
    expect(screen.getByRole("button", { name: "workbooks.deleteWorkbook" })).toBeInTheDocument();
  });

  it("hides the delete button when the current user is NOT the creator", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "other-user", name: "Other", email: "other@test.com" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    render(<WorkbookDetailsSidebar workbookId="wb-123" workbook={workbook} />);
    expect(
      screen.queryByRole("button", { name: "workbooks.deleteWorkbook" }),
    ).not.toBeInTheDocument();
  });

  it("opens a confirmation dialog and deletes the workbook when confirmed", async () => {
    const user = userEvent.setup();
    const deleteSpy = server.mount(contract.workbooks.deleteWorkbook, {
      status: 204,
    });

    const { router } = render(<WorkbookDetailsSidebar workbookId="wb-123" workbook={workbook} />);

    // Click the delete trigger button
    await user.click(screen.getByRole("button", { name: "workbooks.deleteWorkbook" }));

    // Confirmation dialog appears
    expect(screen.getByText("common.confirmDelete")).toBeInTheDocument();

    // Click the destructive confirm button inside the dialog
    const dialogButtons = screen.getAllByRole("button", { name: "workbooks.deleteWorkbook" });
    await user.click(dialogButtons[dialogButtons.length - 1]);

    // Verify the API was called and navigation occurred
    await waitFor(() => {
      expect(deleteSpy.params.id).toBe("wb-123");
    });
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/en-US/platform/workbooks");
    });
  });

  it("closes the dialog when cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<WorkbookDetailsSidebar workbookId="wb-123" workbook={workbook} />);

    await user.click(screen.getByRole("button", { name: "workbooks.deleteWorkbook" }));
    expect(screen.getByText("common.confirmDelete")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "common.cancel" }));

    await waitFor(() => {
      expect(screen.queryByText("common.confirmDelete")).not.toBeInTheDocument();
    });
  });
});
