import {
  createExperiment,
  createExperimentAccess,
  createMarkdownCell,
  createProtocolCell,
  createWorkbookDetail,
  readOnlyCapabilities,
  createWorkbookVersionSummary,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, createTestQueryClient, render, screen, userEvent, waitFor } from "@/test/test-utils";
import { notFound } from "next/navigation";
import { use } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import ExperimentDesignPage from "./experiment-design-content";

vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ error, title }: { error: unknown; title: string }) => (
    <div data-testid="error-display">
      {title}: {String(error)}
    </div>
  ),
}));

vi.mock("@/components/flow-editor/flow-editor", () => ({
  FlowEditor: ({
    initialFlow,
    isDisabled,
  }: {
    initialFlow?: unknown;
    isDisabled?: boolean;
    onDirtyChange?: () => void;
  }) => (
    <div
      data-testid="flow-editor"
      data-initial-flow={initialFlow ? "present" : "null"}
      data-disabled={isDisabled ? "true" : "false"}
    >
      Flow Editor
    </div>
  ),
}));

vi.mock("@/components/workbook/workbook-editor", () => ({
  WorkbookEditor: ({ cells, readOnly }: { cells: unknown[]; readOnly?: boolean }) => (
    <div data-testid="workbook-editor" data-readonly={readOnly ? "true" : "false"}>
      Workbook Editor ({cells.length} cells)
    </div>
  ),
}));

vi.mock("@/components/workbook/workbook-draft-editor", () => ({
  WorkbookDraftEditor: ({
    initialCells,
    cells = initialCells,
    onCellsChange,
    autosaveEnabled,
  }: {
    initialCells: unknown[];
    cells?: unknown[];
    onCellsChange?: (cells: unknown[]) => void;
    autosaveEnabled?: boolean;
  }) => (
    <div
      data-testid="workbook-draft-editor"
      data-autosave-enabled={String(autosaveEnabled ?? true)}
      data-cell-ids={cells
        .map((cell) => (cell as { id?: string }).id)
        .filter(Boolean)
        .join(",")}
    >
      Draft Editor ({initialCells.length} cells)
      <button
        data-testid="trigger-cell-edit"
        onClick={() =>
          onCellsChange?.([
            ...cells,
            { id: "edited-cell", type: "markdown", isCollapsed: false, content: "Edited" },
          ])
        }
      >
        edit cells
      </button>
    </div>
  ),
}));

vi.mock("@/components/workbook/workbook-canvas-draft-editor", () => ({
  WorkbookCanvasDraftEditor: ({
    initialCells,
    cells,
  }: {
    initialCells: unknown[];
    cells: unknown[];
  }) => (
    <div
      data-testid="workbook-canvas-draft-editor"
      data-cell-ids={cells
        .map((cell) => (cell as { id?: string }).id)
        .filter(Boolean)
        .join(",")}
    >
      Canvas Draft Editor ({initialCells.length} cells)
    </div>
  ),
}));

const EXP_ID = "exp-123";
const WB_ID = "wb-1";
const VERSION_ID = "ver-1";
const PROTOCOL_ID = "11111111-1111-1111-1111-111111111111";
const LOCALE = "en-US";
const defaultProps = {
  params: Promise.resolve({ locale: LOCALE, id: EXP_ID }),
};

async function traverseHistory(direction: "back" | "forward") {
  await act(async () => {
    const traversed = new Promise<void>((resolve) => {
      window.addEventListener("popstate", () => resolve(), { once: true });
    });
    window.history[direction]();
    await traversed;
  });
}

const activeExperiment = createExperiment({
  id: EXP_ID,
  status: "active",
  name: "Test Experiment",
});

const experimentWithWorkbook = createExperiment({
  id: EXP_ID,
  status: "active",
  name: "Test Experiment",
  workbookId: WB_ID,
  workbookVersionId: VERSION_ID,
});

const accessPayload = createExperimentAccess({
  experiment: { id: EXP_ID, name: "Test Experiment", status: "active" },
  isAdmin: true,
});

const readOnlyAccessPayload = createExperimentAccess({
  experiment: { id: EXP_ID, name: "Test Experiment", status: "active" },
  isAdmin: false,
});

const versionSummary = createWorkbookVersionSummary({
  id: VERSION_ID,
  workbookId: WB_ID,
  version: 1,
});

const newerVersionSummary = createWorkbookVersionSummary({
  id: "ver-2",
  workbookId: WB_ID,
  version: 2,
});

function mountDefaults() {
  server.mount(contract.experiments.getExperiment, { body: activeExperiment });
  server.mount(contract.experiments.getExperimentAccess, { body: accessPayload });
  server.mount(contract.workbooks.listWorkbooks, { body: [] });
}

function mountWithWorkbook(overrides?: {
  versions?: (typeof versionSummary)[];
  isAdmin?: boolean;
  /** `can(update)` on the linked workbook; defaults to full capability. */
  canUpdateWorkbook?: boolean;
}) {
  server.mount(contract.experiments.getExperiment, { body: experimentWithWorkbook });
  server.mount(contract.experiments.getExperimentAccess, {
    body: overrides?.isAdmin === false ? readOnlyAccessPayload : accessPayload,
  });
  server.mount(contract.workbooks.getWorkbook, {
    body: createWorkbookDetail({
      id: WB_ID,
      name: "Test Workbook",
      description: "Measures canopy temperature",
      cells: [
        createProtocolCell({
          id: "c1",
          payload: { protocolId: PROTOCOL_ID, version: 1, name: "P1" },
        }),
      ],
      ...(overrides?.canUpdateWorkbook === false ? { capabilities: readOnlyCapabilities } : {}),
    }),
  });
  server.mount(contract.workbooks.listWorkbooks, { body: [] });
  server.mount(contract.workbooks.listWorkbookVersions, {
    body: overrides?.versions ?? [versionSummary],
  });
  server.mount(contract.workbooks.getWorkbookVersion, {
    body: {
      ...versionSummary,
      cells: [
        createProtocolCell({
          id: "c1",
          payload: { protocolId: PROTOCOL_ID, version: 1, name: "P1" },
        }),
      ],
      metadata: {},
      entitySnapshots: { protocols: {}, macros: {} },
    },
  });
}

describe("ExperimentDesignPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    vi.mocked(use).mockReturnValue({ id: EXP_ID, locale: LOCALE });
    // Default to a logged-out session so the owner-only edit toggle stays hidden.
    vi.mocked(useSession).mockReturnValue({ data: null, isPending: false } as ReturnType<
      typeof useSession
    >);
  });

  it("renders the experiment design page with title when loaded", async () => {
    mountDefaults();
    render(<ExperimentDesignPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByText("flow.title")).toBeInTheDocument();
    });
  });

  it("displays loading skeleton when experiment is loading", () => {
    server.mount(contract.experiments.getExperiment, { delay: "infinite" });
    server.mount(contract.experiments.getExperimentAccess, { body: accessPayload });
    server.mount(contract.workbooks.listWorkbooks, { body: [] });

    const { container } = render(<ExperimentDesignPage params={defaultProps.params} />);

    // Skeleton elements are rendered during loading
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("displays error state when experiment fails to load", async () => {
    server.mount(contract.experiments.getExperiment, { status: 500 });
    server.mount(contract.experiments.getExperimentAccess, { body: accessPayload });
    server.mount(contract.workbooks.listWorkbooks, { body: [] });

    render(<ExperimentDesignPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByTestId("error-display")).toBeInTheDocument();
      expect(screen.getByTestId("error-display")).toHaveTextContent("failedToLoad");
    });
  });

  it("calls notFound when experiment is archived", async () => {
    const archivedExperiment = createExperiment({ id: EXP_ID, status: "archived" });
    server.mount(contract.experiments.getExperiment, { body: archivedExperiment });
    server.mount(contract.experiments.getExperimentAccess, {
      body: createExperimentAccess({
        experiment: { id: EXP_ID, status: "archived" },
      }),
    });
    server.mount(contract.workbooks.listWorkbooks, { body: [] });

    render(<ExperimentDesignPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(vi.mocked(notFound)).toHaveBeenCalled();
    });
  });

  it("renders the workbook editor when a workbook is linked", async () => {
    mountWithWorkbook();
    render(<ExperimentDesignPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByTestId("workbook-draft-editor")).toBeInTheDocument();
    });
  });

  it("displays the linked workbook description", async () => {
    mountWithWorkbook();
    render(<ExperimentDesignPage params={defaultProps.params} />);

    expect(await screen.findByText("Measures canopy temperature")).toBeInTheDocument();
  });

  it("shows version badge when workbook is linked", async () => {
    mountWithWorkbook();
    render(<ExperimentDesignPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByText("v1")).toBeInTheDocument();
    });
  });

  it("shows detach and change buttons for admin users", async () => {
    mountWithWorkbook();
    render(<ExperimentDesignPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByText("flow.detach")).toBeInTheDocument();
      expect(screen.getByText("flow.changeWorkbook")).toBeInTheDocument();
    });
  });

  it("hides detach and change buttons for non-admin users", async () => {
    mountWithWorkbook({ isAdmin: false });
    render(<ExperimentDesignPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByTestId("workbook-editor")).toBeInTheDocument();
    });
    expect(screen.queryByText("flow.detach")).not.toBeInTheDocument();
    expect(screen.queryByText("flow.changeWorkbook")).not.toBeInTheDocument();
  });

  it("shows upgrade banner when a newer version is available", async () => {
    mountWithWorkbook({ versions: [newerVersionSummary, versionSummary] });
    render(<ExperimentDesignPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByText(/v2 is available/)).toBeInTheDocument();
      expect(screen.getByText(/flow\.reviewAndUpgrade/)).toBeInTheDocument();
    });
  });

  it("does not show upgrade banner when already on latest version", async () => {
    mountWithWorkbook({ versions: [versionSummary] });
    render(<ExperimentDesignPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByTestId("workbook-draft-editor")).toBeInTheDocument();
    });
    expect(screen.queryByText(/is available/)).not.toBeInTheDocument();
  });

  it("shows no-workbook-linked state when no workbook attached", async () => {
    mountDefaults();
    render(<ExperimentDesignPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByText("flow.noWorkbookLinked")).toBeInTheDocument();
    });
  });

  it("displays access loading skeleton", () => {
    server.mount(contract.experiments.getExperiment, { body: activeExperiment });
    server.mount(contract.experiments.getExperimentAccess, { delay: "infinite" });
    server.mount(contract.workbooks.listWorkbooks, { body: [] });

    const { container } = render(<ExperimentDesignPage params={defaultProps.params} />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("displays access error state", async () => {
    server.mount(contract.experiments.getExperiment, { body: activeExperiment });
    server.mount(contract.experiments.getExperimentAccess, { status: 500 });
    server.mount(contract.workbooks.listWorkbooks, { body: [] });

    render(<ExperimentDesignPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByTestId("error-display")).toBeInTheDocument();
    });
  });

  it("shows the read-only editor when the viewer may not update the workbook", async () => {
    mountWithWorkbook({ canUpdateWorkbook: false });
    render(<ExperimentDesignPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByTestId("workbook-editor")).toHaveAttribute("data-readonly", "true");
    });
    expect(screen.queryByTestId("workbook-draft-editor")).not.toBeInTheDocument();
    expect(screen.queryByText("flow.editWorkbook")).not.toBeInTheDocument();
  });

  it("renders the editable draft editor for an admin grantee who created nothing", async () => {
    // The whole point of the capability signal: this user's session id does not
    // match the workbook's `createdBy`, but their grant carries `can(update)`, so
    // they edit in place. The gate this replaced compared identities and sent them
    // to the read-only branch.
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "grantee-not-the-creator" } },
      isPending: false,
    } as unknown as ReturnType<typeof useSession>);
    mountWithWorkbook();
    render(<ExperimentDesignPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByTestId("workbook-draft-editor")).toBeInTheDocument();
    });
    expect(screen.getByTestId("workbook-draft-editor")).toHaveAttribute(
      "data-autosave-enabled",
      "false",
    );
    // No edit/view toggle: anyone who may edit does so in place.
    expect(screen.queryByText("flow.editWorkbook")).not.toBeInTheDocument();
    expect(screen.queryByText("flow.viewPinned")).not.toBeInTheDocument();
  });

  it("renders the editable canvas over the same draft for an admin workbook grantee", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "grantee-not-the-creator" } },
      isPending: false,
    } as unknown as ReturnType<typeof useSession>);
    mountWithWorkbook();
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<ExperimentDesignPage params={defaultProps.params} />);

    const graphTab = await screen.findByRole("tab", { name: "flow.viewGraph" });
    await user.click(graphTab);
    expect(graphTab).toHaveAttribute("data-state", "active");
    expect(await screen.findByTestId("workbook-canvas-draft-editor")).toHaveTextContent("1 cells");
    expect(screen.queryByTestId("flow-editor")).not.toBeInTheDocument();
  });

  it("keeps the graph read-only for a viewer without the edit gate", async () => {
    mountWithWorkbook({ isAdmin: false });
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<ExperimentDesignPage params={defaultProps.params} />);

    await user.click(await screen.findByText("flow.viewGraph"));
    expect(await screen.findByTestId("flow-editor")).toHaveAttribute("data-disabled", "true");
    expect(screen.queryByTestId("workbook-canvas-draft-editor")).not.toBeInTheDocument();
  });

  it("shows the read-only editor for a non-admin who may update the workbook", async () => {
    // May edit the workbook, but is NOT an experiment admin. Auto-apply on save is
    // experiment-admin only, so editing here stays blocked to avoid a failing
    // upgrade on every save — the `hasAccess` conjunct is deliberate.
    mountWithWorkbook({ isAdmin: false });
    render(<ExperimentDesignPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByTestId("workbook-editor")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("workbook-draft-editor")).not.toBeInTheDocument();
  });

  it("finishes the draft save before re-pinning the experiment", async () => {
    mountWithWorkbook();
    let releaseSave: (() => void) | undefined;
    const saveBlocked = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const updateSpy = server.mount(contract.workbooks.updateWorkbook, {
      body: createWorkbookDetail({ id: WB_ID }),
      unblock: saveBlocked,
    });
    const upgradeSpy = server.mount(contract.experiments.upgradeWorkbookVersion, {
      body: { workbookId: WB_ID, workbookVersionId: "ver-2", version: 2 },
    });
    const user = userEvent.setup();
    render(<ExperimentDesignPage params={defaultProps.params} />);

    await user.click(await screen.findByTestId("trigger-cell-edit"));
    await waitFor(() => expect(updateSpy.called).toBe(true), { timeout: 3000 });
    expect(upgradeSpy.called).toBe(false);

    releaseSave?.();
    await waitFor(() => expect(upgradeSpy.called).toBe(true));
    await waitFor(() =>
      expect(window.sessionStorage.getItem(`openjii:workbook-draft:${WB_ID}`)).toBeNull(),
    );
  });

  it("retains a recovered invalid draft until that exact scope wins a save", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
    } as unknown as ReturnType<typeof useSession>);
    const retainedKey = `openjii:workbook-draft:${WB_ID}`;
    const invalidDraft = [
      {
        id: "question-1",
        type: "question",
        isCollapsed: false,
        name: "",
        questionType: "text",
      },
    ];
    window.sessionStorage.setItem(retainedKey, JSON.stringify(invalidDraft));
    mountWithWorkbook();
    render(<ExperimentDesignPage params={defaultProps.params} />);

    await waitFor(() =>
      expect(screen.getByTestId("workbook-draft-editor")).toHaveAttribute(
        "data-cell-ids",
        "question-1",
      ),
    );
    expect(window.sessionStorage.getItem(retainedKey)).toBe(JSON.stringify(invalidDraft));
  });

  it("warns before navigation while a controlled draft has unsaved work", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
    } as unknown as ReturnType<typeof useSession>);
    mountWithWorkbook();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    render(<ExperimentDesignPage params={defaultProps.params} />);

    await user.click(await screen.findByTestId("trigger-cell-edit"));
    expect(window.sessionStorage.getItem(`openjii:workbook-draft:${WB_ID}`)).toContain(
      "edited-cell",
    );
    const beforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);

    await user.click(screen.getByText("flow.editOpenWorkbookLink"));
    expect(confirm).toHaveBeenCalledWith(
      "This workbook still has changes that have not been saved.",
    );

    await traverseHistory("back");
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(confirm).toHaveBeenLastCalledWith(
      "This workbook still has changes that have not been saved.",
    );
    confirm.mockRestore();
  });

  it("preserves Forward history while the loaded draft is clean", async () => {
    window.history.replaceState({}, "", "/workbook-history-start");
    window.history.pushState({}, "", "/workbook-history-forward");
    await traverseHistory("back");
    expect(window.location.pathname).toBe("/workbook-history-start");

    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
    } as unknown as ReturnType<typeof useSession>);
    mountWithWorkbook();
    render(<ExperimentDesignPage params={defaultProps.params} />);
    await screen.findByTestId("workbook-draft-editor");

    await traverseHistory("forward");
    expect(window.location.pathname).toBe("/workbook-history-forward");
  });

  it("resets the controlled draft before edits can target a newly linked workbook", async () => {
    const secondWorkbookId = "wb-2";
    const secondVersionId = "ver-b";
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
    } as unknown as ReturnType<typeof useSession>);
    mountWithWorkbook();
    const queryClient = createTestQueryClient();
    const user = userEvent.setup();
    render(<ExperimentDesignPage params={defaultProps.params} />, { queryClient });

    expect(await screen.findByTestId("workbook-draft-editor")).toHaveAttribute(
      "data-cell-ids",
      "c1",
    );

    server.mount(contract.experiments.getExperiment, {
      body: createExperiment({
        id: EXP_ID,
        status: "active",
        name: "Test Experiment",
        workbookId: secondWorkbookId,
        workbookVersionId: secondVersionId,
      }),
    });
    const secondCells = [
      createMarkdownCell({ id: "b1", content: "Second workbook" }),
      createMarkdownCell({ id: "b2", content: "Only B" }),
    ];
    const secondWorkbook = createWorkbookDetail({
      id: secondWorkbookId,
      name: "Second Workbook",
      cells: secondCells,
    });
    server.mount(contract.workbooks.getWorkbook, { body: secondWorkbook });
    server.mount(contract.workbooks.listWorkbookVersions, {
      body: [
        createWorkbookVersionSummary({
          id: secondVersionId,
          workbookId: secondWorkbookId,
          version: 1,
        }),
      ],
    });
    server.mount(contract.workbooks.getWorkbookVersion, {
      body: {
        id: secondVersionId,
        workbookId: secondWorkbookId,
        version: 1,
        cells: secondCells,
        metadata: {},
        entitySnapshots: { protocols: {}, macros: {} },
      },
    });
    const updateSpy = server.mount(contract.workbooks.updateWorkbook, { body: secondWorkbook });
    server.mount(contract.experiments.upgradeWorkbookVersion, {
      body: { workbookId: secondWorkbookId, workbookVersionId: secondVersionId, version: 1 },
    });

    await queryClient.invalidateQueries();
    await waitFor(() =>
      expect(screen.getByTestId("workbook-draft-editor")).toHaveAttribute("data-cell-ids", "b1,b2"),
    );

    await user.click(screen.getByTestId("trigger-cell-edit"));
    await waitFor(() => expect(updateSpy.called).toBe(true), { timeout: 3000 });

    expect(updateSpy.params.id).toBe(secondWorkbookId);
    expect((updateSpy.body as { cells: { id: string }[] }).cells.map((cell) => cell.id)).toEqual([
      "b1",
      "b2",
      "edited-cell",
    ]);

    await user.click(screen.getByRole("tab", { name: "flow.viewGraph" }));
    expect(await screen.findByTestId("workbook-canvas-draft-editor")).toHaveAttribute(
      "data-cell-ids",
      "b1,b2,edited-cell",
    );
  });
});
