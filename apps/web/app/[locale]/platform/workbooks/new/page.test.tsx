import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";

import NewWorkbookPage from "./page";

describe("NewWorkbookPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading spinner while the workbook is being created", () => {
    server.mount(contract.workbooks.createWorkbook, {
      body: createWorkbook({ id: "wb-new" }),
    });
    render(<NewWorkbookPage />);
    expect(screen.getByText("newWorkbook.creating")).toBeInTheDocument();
  });

  it("creates a workbook and redirects to it on success", async () => {
    const createSpy = server.mount(contract.workbooks.createWorkbook, {
      body: createWorkbook({ id: "wb-new-123" }),
    });

    const { router } = render(<NewWorkbookPage />);

    // The workbook name includes today's date
    await waitFor(() => {
      expect(createSpy.body?.name).toContain("Untitled Workbook");
    });

    // On success, user is redirected to the new workbook
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/en-US/platform/workbooks/wb-new-123");
    });
  });

  it("navigates back when creation fails", async () => {
    server.mount(contract.workbooks.createWorkbook, { status: 500 });

    const { router } = render(<NewWorkbookPage />);

    await waitFor(() => {
      expect(router.back).toHaveBeenCalled();
    });
  });
});
