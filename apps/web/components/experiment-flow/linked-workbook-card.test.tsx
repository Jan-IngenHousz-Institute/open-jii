import { createExperiment, createWorkbook, createWorkbookVersionSummary } from "@/test/factories";
import { server } from "@/test/msw/server";
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

  it("shows version badge for the pinned version", async () => {
    mountDefaults();
    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("v1")).toBeInTheDocument());
  });

  it("shows upgrade banner when a newer version is available", async () => {
    mountDefaults();
    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText(/v2 is available/)).toBeInTheDocument());
  });

  it("hides upgrade banner when pinned version is latest", async () => {
    server.mount(contract.workbooks.getWorkbook, { body: workbook });
    server.mount(contract.workbooks.listWorkbookVersions, { body: [v1] });
    server.mount(contract.workbooks.listWorkbooks, { body: [workbook] });

    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("v1")).toBeInTheDocument());
    expect(screen.queryByText(/is available/)).not.toBeInTheDocument();
  });

  // isUpgradable drift shows the banner even with no newer published version.
  it("shows the drift banner when isUpgradable is true without a newer published version", async () => {
    server.mount(contract.workbooks.getWorkbook, { body: { ...workbook, isUpgradable: true } });
    server.mount(contract.workbooks.listWorkbookVersions, { body: [v1] });
    server.mount(contract.workbooks.listWorkbooks, { body: [workbook] });

    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByText(/Workbook has updates available/)).toBeInTheDocument(),
    );
  });

  // Once accepted (isUpgradable false, pinned == latest) the prompt stays gone.
  it("hides the banner when isUpgradable is false and pinned is latest (offered once)", async () => {
    server.mount(contract.workbooks.getWorkbook, { body: { ...workbook, isUpgradable: false } });
    server.mount(contract.workbooks.listWorkbookVersions, { body: [v1] });
    server.mount(contract.workbooks.listWorkbooks, { body: [workbook] });

    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText("v1")).toBeInTheDocument());
    expect(screen.queryByText(/is available/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Workbook has updates available/)).not.toBeInTheDocument();
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
    await waitFor(() => expect(screen.getByText(/v2 is available/)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /flow\.upgradeToLatest/ }));

    const confirmBtn = screen
      .getAllByText("flow.confirmUpgrade")
      .find((el) => el.closest("[role='alertdialog']"));
    expect(confirmBtn).toBeDefined();
    if (confirmBtn) await user.click(confirmBtn);

    await waitFor(() => expect(spy.called).toBe(true));
    // The "upgraded" toast was intentionally removed; no success toast fires.
    expect(toast).not.toHaveBeenCalledWith({ description: "flow.versionUpgraded" });
  });

  it("shows error toast when upgrade fails", async () => {
    mountDefaults();
    server.mount(contract.experiments.upgradeWorkbookVersion, { status: 500 });
    const user = userEvent.setup();
    render(<LinkedWorkbookCard {...defaultProps} />);
    await waitFor(() => expect(screen.getByText(/v2 is available/)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /flow\.upgradeToLatest/ }));

    const confirmBtn = screen
      .getAllByText("flow.confirmUpgrade")
      .find((el) => el.closest("[role='alertdialog']"));
    if (confirmBtn) await user.click(confirmBtn);

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({
        description: "flow.upgradeFailed",
        variant: "destructive",
      }),
    );
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
