import { createExperiment, createWorkbook, createWorkbookVersionSummary } from "@/test/factories";
import { server } from "@/test/msw/server";
import { structuralIssue, structuralValidationErrorBody } from "@/test/orpc-error";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { LinkedWorkbookCard } from "./linked-workbook-card";

const workbook = createWorkbook({ id: "wb-1", name: "Test Workbook" });
const otherWorkbook = createWorkbook({ id: "wb-2", name: "Other Workbook" });
const v1 = createWorkbookVersionSummary({ id: "ver-1", workbookId: "wb-1", version: 1 });
const v2 = createWorkbookVersionSummary({ id: "ver-2", workbookId: "wb-1", version: 2 });

const defaultProps = {
  experimentId: "exp-1",
  locale: "en-US",
  workbookId: "wb-1",
  workbookVersionId: "ver-1",
  hasAccess: true,
};

function mountDefaults() {
  server.mount(contract.workbooks.getWorkbook, { body: workbook });
  server.mount(contract.workbooks.listWorkbookVersions, { body: [v2, v1] });
  server.mount(contract.workbooks.listWorkbooks, { body: [workbook, otherWorkbook] });
  // The upgrade review dialog fetches the pinned version to diff against live.
  server.mount(contract.workbooks.getWorkbookVersion, {
    body: {
      id: "ver-1",
      workbookId: "wb-1",
      version: 1,
      cells: [],
      metadata: {},
      entitySnapshots: { protocols: {}, macros: {} },
      createdAt: "2025-01-01T00:00:00.000Z",
      createdBy: "user-1",
    },
  });
}

describe("LinkedWorkbookCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the workbook name after loading", async () => {
    mountDefaults();
    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Test Workbook")).toBeInTheDocument());
  });

  it("renders a link to the workbook page", async () => {
    mountDefaults();
    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Test Workbook")).toBeInTheDocument());
    expect(screen.getByRole("link")).toHaveAttribute("href", "/en-US/platform/workbooks/wb-1");
  });

  it("renders a line-clamped plain-text description without a section heading", async () => {
    server.mount(contract.workbooks.getWorkbook, {
      body: {
        ...workbook,
        description: "<p>Measures <strong>chlorophyll</strong>&nbsp; fluorescence</p>",
      },
    });
    server.mount(contract.workbooks.listWorkbookVersions, { body: [v2, v1] });
    server.mount(contract.workbooks.listWorkbooks, { body: [workbook, otherWorkbook] });

    render(<LinkedWorkbookCard {...defaultProps} />);

    const description = await screen.findByText("Measures chlorophyll fluorescence");
    expect(description).toHaveClass("line-clamp-2");
    expect(screen.queryByText("workbooks.descriptionTitle")).not.toBeInTheDocument();
    expect(screen.getByText(/workbooks.lastUpdate.*Test User/)).toBeInTheDocument();
  });

  it("shows version badge for the pinned version", async () => {
    mountDefaults();
    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("v1")).toBeInTheDocument());
  });

  it("opens the version history dialog from the history button", async () => {
    mountDefaults();
    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Test Workbook")).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "flow.versionHistory.open" }));

    expect(await screen.findByText("flow.versionHistory.title")).toBeInTheDocument();
  });

  it("shows upgrade banner when a newer version is available", async () => {
    mountDefaults();
    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("flow.upgradeBanner.newVersion")).toBeInTheDocument());
  });

  it("hides upgrade banner when pinned version is latest", async () => {
    server.mount(contract.workbooks.getWorkbook, { body: workbook });
    server.mount(contract.workbooks.listWorkbookVersions, { body: [v1] });
    server.mount(contract.workbooks.listWorkbooks, { body: [workbook] });

    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("v1")).toBeInTheDocument());
    expect(screen.queryByText("flow.upgradeBanner.newVersion")).not.toBeInTheDocument();
  });

  // isUpgradable drift shows the banner even with no newer published version.
  it("shows the drift banner when isUpgradable is true without a newer published version", async () => {
    server.mount(contract.workbooks.getWorkbook, { body: { ...workbook, isUpgradable: true } });
    server.mount(contract.workbooks.listWorkbookVersions, { body: [v1] });
    server.mount(contract.workbooks.listWorkbooks, { body: [workbook] });

    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByText("flow.upgradeBanner.updatesAvailable")).toBeInTheDocument(),
    );
  });

  // Once accepted (isUpgradable false, pinned == latest) the prompt stays gone.
  it("hides the banner when isUpgradable is false and pinned is latest (offered once)", async () => {
    server.mount(contract.workbooks.getWorkbook, { body: { ...workbook, isUpgradable: false } });
    server.mount(contract.workbooks.listWorkbookVersions, { body: [v1] });
    server.mount(contract.workbooks.listWorkbooks, { body: [workbook] });

    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("v1")).toBeInTheDocument());
    expect(screen.queryByText("flow.upgradeBanner.newVersion")).not.toBeInTheDocument();
    expect(screen.queryByText("flow.upgradeBanner.updatesAvailable")).not.toBeInTheDocument();
  });

  it("hides controls when hasAccess is false", async () => {
    mountDefaults();
    render(<LinkedWorkbookCard {...defaultProps} hasAccess={false} />);
    await waitFor(() => expect(screen.getByText("Test Workbook")).toBeInTheDocument());
    expect(screen.queryByText("flow.changeWorkbook")).not.toBeInTheDocument();
    expect(screen.queryByText("flow.detach")).not.toBeInTheDocument();
  });

  it("toggles the change workbook inline picker", async () => {
    mountDefaults();
    const user = userEvent.setup();
    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Test Workbook")).toBeInTheDocument());

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    await user.click(screen.getByText("flow.changeWorkbook"));
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("detaches workbook via confirm dialog and shows toast", async () => {
    mountDefaults();
    const spy = server.mount(contract.experiments.detachWorkbook, {
      body: createExperiment({ id: "exp-1" }),
    });
    const user = userEvent.setup();
    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Test Workbook")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /flow\.detach/ }));

    const confirmBtn = screen
      .getAllByText("flow.detach")
      .find((el) => el.closest("[role='alertdialog']"));
    expect(confirmBtn).toBeDefined();
    if (confirmBtn) await user.click(confirmBtn);

    await waitFor(() => expect(spy.called).toBe(true));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({ description: "flow.workbookDetached" }),
    );
  });

  it("shows error toast when detach fails", async () => {
    mountDefaults();
    server.mount(contract.experiments.detachWorkbook, { status: 500 });
    const user = userEvent.setup();
    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Test Workbook")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /flow\.detach/ }));
    const confirmBtn = screen
      .getAllByText("flow.detach")
      .find((el) => el.closest("[role='alertdialog']"));
    if (confirmBtn) await user.click(confirmBtn);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        description: "flow.detachFailed",
        variant: "destructive",
      }),
    );
  });

  it("upgrades to latest version (no toast)", async () => {
    mountDefaults();
    const spy = server.mount(contract.experiments.upgradeWorkbookVersion, {
      body: { workbookId: "wb-1", workbookVersionId: "ver-2", version: 2 },
    });
    const user = userEvent.setup();
    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("flow.upgradeBanner.newVersion")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /flow\.reviewAndUpgrade/ }));

    // The review dialog opens; confirm once it has loaded the diff.
    const confirmBtn = await screen.findByRole("button", { name: /flow\.confirmUpgrade/ });
    await waitFor(() => expect(confirmBtn).not.toBeDisabled());
    await user.click(confirmBtn);

    await waitFor(() => expect(spy.called).toBe(true));
    // The "upgraded" toast was intentionally removed; no success toast fires.
    expect(toast).not.toHaveBeenCalledWith({ description: "flow.versionUpgraded" });
  });

  it("recovers from a structural upgrade rejection: reject -> close/reopen -> retry succeeds", async () => {
    mountDefaults();
    // First upgrade attempt is rejected with a structural validation envelope.
    const spy = server.mount(contract.experiments.upgradeWorkbookVersion, {
      status: 400,
      body: structuralValidationErrorBody([
        structuralIssue({ commandCellId: "cmd-ref", secretLeak: "TOP-SECRET" }),
      ]),
    });
    const user = userEvent.setup();
    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("flow.upgradeBanner.newVersion")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /flow\.reviewAndUpgrade/ }));
    const confirmBtn = await screen.findByRole("button", { name: /flow\.confirmUpgrade/ });
    await waitFor(() => expect(confirmBtn).not.toBeDisabled());
    await user.click(confirmBtn);

    // The rejection is shown as repairable server issues (keyed by command), no
    // sentinel leaks, no generic toast, and Confirm is now blocked.
    const issues = await screen.findByTestId("upgrade-server-issues");
    expect(issues).toHaveTextContent("cmd-ref");
    expect(screen.queryByText(/TOP-SECRET/)).not.toBeInTheDocument();
    expect(toast).not.toHaveBeenCalledWith({
      description: "flow.upgradeFailed",
      variant: "destructive",
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /flow\.confirmUpgrade/ })).toBeDisabled(),
    );
    expect(spy.callCount).toBe(1);

    // Close the dialog, then the workbook is repaired and republished -> success.
    await user.click(screen.getByRole("button", { name: "cancel" }));
    const successSpy = server.mount(contract.experiments.upgradeWorkbookVersion, {
      body: { workbookId: "wb-1", workbookVersionId: "ver-2", version: 2 },
    });

    // Reopening resets the retained rejection so Confirm can start a new mutation.
    await user.click(screen.getByRole("button", { name: /flow\.reviewAndUpgrade/ }));
    const confirmAgain = await screen.findByRole("button", { name: /flow\.confirmUpgrade/ });
    await waitFor(() => expect(confirmAgain).not.toBeDisabled());
    await user.click(confirmAgain);

    // The second mutation runs (was permanently blocked before the reset fix) and
    // succeeds; the dialog closes and no stale server issues remain.
    await waitFor(() => expect(successSpy.called).toBe(true));
    await waitFor(() =>
      expect(screen.queryByTestId("upgrade-server-issues")).not.toBeInTheDocument(),
    );
  });

  it("shows error toast when upgrade fails", async () => {
    mountDefaults();
    server.mount(contract.experiments.upgradeWorkbookVersion, { status: 500 });
    const user = userEvent.setup();
    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("flow.upgradeBanner.newVersion")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /flow\.reviewAndUpgrade/ }));

    const confirmBtn = await screen.findByRole("button", { name: /flow\.confirmUpgrade/ });
    await waitFor(() => expect(confirmBtn).not.toBeDisabled());
    await user.click(confirmBtn);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        description: "flow.upgradeFailed",
        variant: "destructive",
      }),
    );
  });

  it("hides the rename affordance for non-owners", async () => {
    mountDefaults();
    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Test Workbook")).toBeInTheDocument());
    expect(screen.queryByLabelText("flow.renameWorkbook")).not.toBeInTheDocument();
  });

  it("renames the workbook in place when the user owns it", async () => {
    mountDefaults();
    const spy = server.mount(contract.workbooks.updateWorkbook, {
      body: { ...workbook, name: "Renamed Workbook" },
    });
    const user = userEvent.setup();
    render(<LinkedWorkbookCard {...defaultProps} isWorkbookOwner />);
    await waitFor(() => expect(screen.getByText("Test Workbook")).toBeInTheDocument());

    await user.click(screen.getByLabelText("flow.renameWorkbook"));
    const input = screen.getByLabelText("flow.renameWorkbook");
    await user.clear(input);
    await user.type(input, "Renamed Workbook");
    await user.click(screen.getByRole("button", { name: "flow.saveRename" }));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toMatchObject({ name: "Renamed Workbook" });
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({ description: "flow.workbookRenamed" }),
    );
  });

  it("saves the rename when the user presses Enter", async () => {
    mountDefaults();
    const spy = server.mount(contract.workbooks.updateWorkbook, {
      body: { ...workbook, name: "Via Enter" },
    });
    const user = userEvent.setup();
    render(<LinkedWorkbookCard {...defaultProps} isWorkbookOwner />);
    await waitFor(() => expect(screen.getByText("Test Workbook")).toBeInTheDocument());

    await user.click(screen.getByLabelText("flow.renameWorkbook"));
    const input = screen.getByLabelText("flow.renameWorkbook");
    await user.clear(input);
    await user.type(input, "Via Enter{Enter}");

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toMatchObject({ name: "Via Enter" });
  });

  it("cancels the rename with Escape", async () => {
    mountDefaults();
    const user = userEvent.setup();
    render(<LinkedWorkbookCard {...defaultProps} isWorkbookOwner />);
    await waitFor(() => expect(screen.getByText("Test Workbook")).toBeInTheDocument());

    await user.click(screen.getByLabelText("flow.renameWorkbook"));
    await user.type(screen.getByLabelText("flow.renameWorkbook"), "scrap{Escape}");

    await waitFor(() => expect(screen.getByRole("link")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "flow.saveRename" })).not.toBeInTheDocument();
  });

  it("cancels the rename via the cancel button", async () => {
    mountDefaults();
    const user = userEvent.setup();
    render(<LinkedWorkbookCard {...defaultProps} isWorkbookOwner />);
    await waitFor(() => expect(screen.getByText("Test Workbook")).toBeInTheDocument());

    await user.click(screen.getByLabelText("flow.renameWorkbook"));
    await user.click(screen.getByRole("button", { name: "cancel" }));

    await waitFor(() => expect(screen.getByRole("link")).toBeInTheDocument());
  });

  it("does not call update when the rename leaves the name unchanged", async () => {
    mountDefaults();
    const spy = server.mount(contract.workbooks.updateWorkbook, { body: workbook });
    const user = userEvent.setup();
    render(<LinkedWorkbookCard {...defaultProps} isWorkbookOwner />);
    await waitFor(() => expect(screen.getByText("Test Workbook")).toBeInTheDocument());

    await user.click(screen.getByLabelText("flow.renameWorkbook"));
    await user.click(screen.getByRole("button", { name: "flow.saveRename" }));

    await waitFor(() => expect(screen.getByRole("link")).toBeInTheDocument());
    expect(spy.called).toBe(false);
  });

  it("shows an error toast when the rename fails", async () => {
    mountDefaults();
    server.mount(contract.workbooks.updateWorkbook, { status: 500 });
    const user = userEvent.setup();
    render(<LinkedWorkbookCard {...defaultProps} isWorkbookOwner />);
    await waitFor(() => expect(screen.getByText("Test Workbook")).toBeInTheDocument());

    await user.click(screen.getByLabelText("flow.renameWorkbook"));
    const input = screen.getByLabelText("flow.renameWorkbook");
    await user.clear(input);
    await user.type(input, "New Name");
    await user.click(screen.getByRole("button", { name: "flow.saveRename" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        description: "flow.renameFailed",
        variant: "destructive",
      }),
    );
  });

  it("closes the change-workbook picker via cancel", async () => {
    mountDefaults();
    const user = userEvent.setup();
    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Test Workbook")).toBeInTheDocument());

    await user.click(screen.getByText("flow.changeWorkbook"));
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "cancel" }));

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows an error toast when attaching a changed workbook fails", async () => {
    mountDefaults();
    server.mount(contract.experiments.attachWorkbook, { status: 500 });
    const user = userEvent.setup();
    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Test Workbook")).toBeInTheDocument());

    await user.click(screen.getByText("flow.changeWorkbook"));
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Other Workbook"));
    await user.click(screen.getByRole("button", { name: /flow\.attach/ }));

    const confirmBtn = screen
      .getAllByText("flow.confirmChange")
      .find((el) => el.closest("[role='alertdialog']"));
    if (confirmBtn) await user.click(confirmBtn);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        description: "flow.attachFailed",
        variant: "destructive",
      }),
    );
  });

  it("shows inline repairable issues (not a toast) when a changed-workbook attach is structurally rejected", async () => {
    mountDefaults();
    server.mount(contract.experiments.attachWorkbook, {
      status: 400,
      body: structuralValidationErrorBody([
        structuralIssue({ commandCellId: "cmd-z", secretLeak: "TOP-SECRET" }),
      ]),
    });
    const user = userEvent.setup();
    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Test Workbook")).toBeInTheDocument());

    await user.click(screen.getByText("flow.changeWorkbook"));
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Other Workbook"));
    await user.click(screen.getByRole("button", { name: /flow\.attach/ }));
    const confirmBtn = screen
      .getAllByText("flow.confirmChange")
      .find((el) => el.closest("[role='alertdialog']"));
    if (confirmBtn) await user.click(confirmBtn);

    const issues = await screen.findByTestId("structural-issues");
    expect(issues).toHaveAttribute("role", "alert");
    expect(issues).toHaveTextContent("cmd-z");
    expect(
      screen.getByRole("link", { name: "flow.structuralAttach.openWorkbook" }),
    ).toHaveAttribute("href", "/en-US/platform/workbooks/wb-2");
    // The picker stays open for repair; no leak, no generic toast.
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.queryByText(/TOP-SECRET/)).not.toBeInTheDocument();
    expect(toast).not.toHaveBeenCalledWith({
      description: "flow.attachFailed",
      variant: "destructive",
    });
  });

  it("changes workbook via attach confirm dialog", async () => {
    mountDefaults();
    const spy = server.mount(contract.experiments.attachWorkbook, {
      body: { workbookId: "wb-2", workbookVersionId: "ver-3", version: 1 },
    });
    const user = userEvent.setup();
    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("Test Workbook")).toBeInTheDocument());

    await user.click(screen.getByText("flow.changeWorkbook"));

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Other Workbook"));

    await user.click(screen.getByRole("button", { name: /flow\.attach/ }));

    const confirmBtn = screen
      .getAllByText("flow.confirmChange")
      .find((el) => el.closest("[role='alertdialog']"));
    expect(confirmBtn).toBeDefined();
    if (confirmBtn) await user.click(confirmBtn);

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toMatchObject({ workbookId: "wb-2" });
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({ description: "flow.workbookAttached" }),
    );
  });
});
