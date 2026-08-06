import { act, render } from "@/test/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import { WorkbookDraftEditor } from "./workbook-draft-editor";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  autosaveReport: { current: undefined as { status: string; error: unknown } | undefined },
}));

vi.mock("@/components/shared/autosave/autosave-status-context", () => ({
  useReportAutosaveStatus: (report: { status: string; error: unknown }) => {
    mocks.autosaveReport.current = report;
  },
}));
vi.mock("@/components/workbook/parallel-track-board", () => ({
  ParallelTrackBoard: () => null,
}));
vi.mock("@/components/workbook/workbook-editor", () => ({
  WorkbookEditor: ({ cells }: { cells: WorkbookCell[] }) => (
    <div data-testid="workbook-editor">{cells.length}</div>
  ),
}));
vi.mock("@/hooks/workbook/useWorkbookUpdate/useWorkbookUpdate", () => ({
  useWorkbookUpdate: () => ({ mutateAsync: mocks.update }),
}));
vi.mock("@/hooks/workbook/useWorkbookExecution/useWorkbookExecution", () => ({
  useWorkbookExecution: () => ({
    isConnected: false,
    isConnecting: false,
    connectedDevices: [],
    sensorFamily: "multispeq",
    setSensorFamily: vi.fn(),
    connectionType: "serial",
    setConnectionType: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    disconnectDevice: vi.fn(),
    executionStates: {},
    lastRunCompletion: undefined,
    isRunningAll: false,
    runCell: vi.fn(),
    runAll: vi.fn(),
    stopExecution: vi.fn(),
    abandonLane: vi.fn(),
    restartContainerAttempt: vi.fn(),
    clearOutputs: vi.fn(),
    runnerState: undefined,
  }),
}));
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const cell = (id: string, content = id): Extract<WorkbookCell, { type: "markdown" }> => ({
  id,
  type: "markdown",
  isCollapsed: false,
  content,
});

const container = (id: string, name: string): WorkbookCell => ({
  id,
  type: "parallel",
  isCollapsed: false,
  name,
  defaultLaneId: `${id}-lane`,
  lanes: [
    {
      id: `${id}-lane`,
      label: "Lane",
      color: "#64748b",
      conditions: [],
      body: [cell(`${id}-body`)],
    },
  ],
});

const invalidIdentityDrafts: [string, WorkbookCell[]][] = [
  ["duplicate cell ids", [cell("shared", "First"), cell("shared", "Second")]],
  [
    "canonical container-name collisions",
    [container("parallel-a", "plot id"), container("parallel-b", "plot-id")],
  ],
];

const props = {
  id: "workbook-a",
  initialCells: [cell("a0")],
  canEdit: true,
  name: "Workbook",
};

describe("WorkbookDraftEditor autosave validation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.update.mockResolvedValue({ id: "workbook-a" });
    mocks.autosaveReport.current = undefined;
  });

  afterEach(() => vi.useRealTimers());

  it.each(invalidIdentityDrafts)("blocks local autosave for %s", async (_caseName, cells) => {
    const view = render(<WorkbookDraftEditor {...props} cells={props.initialCells} />);

    view.rerender(<WorkbookDraftEditor {...props} cells={cells} />);
    await act(async () => vi.advanceTimersByTimeAsync(1600));

    expect(mocks.autosaveReport.current?.status).toBe("error");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("autosaves a valid container draft", async () => {
    const cells = [container("parallel-a", "plot id")];
    const view = render(<WorkbookDraftEditor {...props} cells={props.initialCells} />);

    view.rerender(<WorkbookDraftEditor {...props} cells={cells} />);
    await act(async () => vi.advanceTimersByTimeAsync(1600));

    expect(mocks.update).toHaveBeenCalledWith({ id: "workbook-a", cells });
    expect(mocks.autosaveReport.current?.status).toBe("idle");
  });
});
