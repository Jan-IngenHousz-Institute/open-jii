import { createWorkbookVersionSummary } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { WorkbookVersionHistoryDialog } from "./workbook-version-history-dialog";

const v1 = createWorkbookVersionSummary({ id: "ver-1", workbookId: "wb-1", version: 1 });
const v2 = createWorkbookVersionSummary({ id: "ver-2", workbookId: "wb-1", version: 2 });

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  experimentId: "exp-1",
  workbookId: "wb-1",
  currentVersionId: "ver-2",
  canManage: true,
};

describe("WorkbookVersionHistoryDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.mount(contract.workbooks.listWorkbookVersions, { body: [v2, v1] });
  });

  it("lists versions and marks the pinned one as current", async () => {
    render(<WorkbookVersionHistoryDialog {...baseProps} />);
    await waitFor(() => expect(screen.getByText("v2")).toBeInTheDocument());
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("flow.versionHistory.current")).toBeInTheDocument();
  });

  it("restores an earlier version after confirmation", async () => {
    const spy = server.mount(contract.experiments.setWorkbookVersion, {
      status: 200,
      body: { workbookId: "wb-1", workbookVersionId: "ver-1", version: 1 },
    });
    const user = userEvent.setup();
    render(<WorkbookVersionHistoryDialog {...baseProps} />);

    await waitFor(() => expect(screen.getByText("v1")).toBeInTheDocument());
    // Only the non-current version (v1) offers Restore.
    await user.click(screen.getByRole("button", { name: "flow.versionHistory.restore" }));

    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "flow.versionHistory.restore" }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toEqual({ versionId: "ver-1" });
    await waitFor(() => expect(baseProps.onOpenChange).toHaveBeenCalledWith(false));
  });

  it("shows a destructive toast when restore fails", async () => {
    server.mount(contract.experiments.setWorkbookVersion, {
      status: 500,
      body: { message: "boom" },
    });
    const user = userEvent.setup();
    render(<WorkbookVersionHistoryDialog {...baseProps} />);

    await waitFor(() => expect(screen.getByText("v1")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "flow.versionHistory.restore" }));
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "flow.versionHistory.restore" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        description: "flow.versionHistory.restoreFailed",
        variant: "destructive",
      }),
    );
  });

  it("dismisses the restore confirmation via cancel without restoring", async () => {
    const spy = server.mount(contract.experiments.setWorkbookVersion, {
      status: 200,
      body: { workbookId: "wb-1", workbookVersionId: "ver-1", version: 1 },
    });
    const user = userEvent.setup();
    render(<WorkbookVersionHistoryDialog {...baseProps} />);

    await waitFor(() => expect(screen.getByText("v1")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "flow.versionHistory.restore" }));

    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(spy.called).toBe(false);
  });

  it("hides restore controls for non-managers", async () => {
    render(<WorkbookVersionHistoryDialog {...baseProps} canManage={false} />);
    await waitFor(() => expect(screen.getByText("v1")).toBeInTheDocument());
    expect(
      screen.queryByRole("button", { name: "flow.versionHistory.restore" }),
    ).not.toBeInTheDocument();
  });
});
