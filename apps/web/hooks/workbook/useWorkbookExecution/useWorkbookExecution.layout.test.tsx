import {
  __resetProtocolCodeRegistry,
  registerProtocolCodeSource,
} from "@/lib/protocol-code-registry";
import { act, render } from "@/test/test-utils";
import { useLayoutEffect, useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import { useWorkbookExecution } from "./useWorkbookExecution";

const mockExecuteProtocol = vi.fn();
const mockExecuteCommand = vi.fn();

vi.mock("~/hooks/iot/useIotConnections/useIotConnections", () => ({
  useIotConnections: () => ({
    connections: [
      {
        id: "dev-1",
        label: "D1",
        family: "multispeq" as const,
        identity: { family: "multispeq" as const, name: "D1", raw: {} },
        driver: {},
      },
    ],
    isConnecting: false,
    error: null,
    connect: vi.fn(),
    disconnectDevice: vi.fn(),
    disconnectAll: vi.fn(),
  }),
}));

vi.mock("~/hooks/iot/useIotProtocolExecution/useIotProtocolExecution", () => ({
  executeProtocolWithDriver: (): unknown => mockExecuteProtocol(),
  executeCommandWithDriver: (_driver: unknown, command: unknown): unknown =>
    mockExecuteCommand(command),
}));

const SRC_PID = "22222222-2222-2222-2222-222222222222";
const src: WorkbookCell = {
  id: "src",
  type: "protocol",
  isCollapsed: false,
  payload: { protocolId: SRC_PID, version: 1, name: "Src" },
};
const cmd: WorkbookCell = {
  id: "cmd",
  type: "command",
  isCollapsed: false,
  payload: { kind: "ref", ref: { sourceCellId: "src", field: "value" } },
};

type Exec = ReturnType<typeof useWorkbookExecution>;

/**
 * Exposes the hook and runs `src` from a LAYOUT effect (which fires after the
 * hook's own layout effect, so after the atomic key transition): the exact
 * layout window the reviewer flagged. `onCommit` applies the transform to the
 * shared committed state.
 */
function LayoutHarness({
  workbookId,
  runSrc,
  apiRef,
  onCommit,
}: {
  workbookId: string;
  runSrc: boolean;
  apiRef: { current: Exec | null };
  onCommit: (update: (latest: WorkbookCell[]) => WorkbookCell[]) => void;
}) {
  const exec = useWorkbookExecution({ cells: [src, cmd], onCellsChange: onCommit, workbookId });
  apiRef.current = exec;
  const started = useRef(false);
  useLayoutEffect(() => {
    if (runSrc && !started.current) {
      started.current = true;
      void exec.runCell("src");
    }
    // exec identity changes each render; the started guard makes this run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runSrc]);
  return null;
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("useWorkbookExecution layout-window key transition", () => {
  beforeEach(() => {
    __resetProtocolCodeRegistry();
    mockExecuteProtocol.mockReset();
    mockExecuteCommand.mockReset();
    registerProtocolCodeSource(SRC_PID, () => [{ _protocol_set_: [] }]);
    mockExecuteProtocol.mockResolvedValue({ value: "measure" });
    mockExecuteCommand.mockResolvedValue("ok");
  });

  it("an execution started in the layout window after a key change binds the new key/epoch and survives passive effects", async () => {
    let committed: WorkbookCell[] = [src, cmd];
    const onCommit = (update: (latest: WorkbookCell[]) => WorkbookCell[]) => {
      committed = update(committed);
    };
    const apiRef: { current: Exec | null } = { current: null };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { rerender } = render(
      <LayoutHarness workbookId="wb-1" runSrc={false} apiRef={apiRef} onCommit={onCommit} />,
    );

    // Commit a NEW workbook key and enable the layout-phase src run in one update.
    // The hook's atomic layout effect (invalidate + publish new key/epoch) runs
    // before the harness layout effect that starts `src`.
    await act(async () => {
      rerender(<LayoutHarness workbookId="wb-2" runSrc apiRef={apiRef} onCommit={onCommit} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await flush();

    // The layout-window source recorded under the post-transition epoch, so a
    // ref command now resolves against it (it was NOT stranded/cleared by a
    // later passive invalidation). Under the old two-phase transition the source
    // would have recorded under the pre-invalidation epoch and been cleared.
    await act(() => apiRef.current?.runCell("cmd") ?? Promise.resolve());
    expect(mockExecuteCommand).toHaveBeenCalledWith("measure");
    // The source's display output survived passive effects.
    expect(committed.some((c) => c.type === "output" && c.producedBy === "src")).toBe(true);
    warn.mockRestore();
  });

  it("an old transform queued before a key change is inert when applied after it", async () => {
    // Queue (do not apply) transforms so we can apply one across the transition.
    const queued: ((latest: WorkbookCell[]) => WorkbookCell[])[] = [];
    const apiRef: { current: Exec | null } = { current: null };

    const { rerender } = render(
      <LayoutHarness workbookId="wb-1" runSrc apiRef={apiRef} onCommit={(u) => queued.push(u)} />,
    );
    await flush();
    expect(queued.length).toBeGreaterThan(0);
    const preTransition = queued[queued.length - 1];

    // Commit the key transition (atomic invalidate + publish in the layout phase).
    act(() => {
      rerender(
        <LayoutHarness workbookId="wb-2" runSrc apiRef={apiRef} onCommit={(u) => queued.push(u)} />,
      );
    });

    // Applying the pre-transition transform now is a no-op (token inert).
    const latest = [src, cmd];
    expect(preTransition(latest)).toBe(latest);
  });
});
