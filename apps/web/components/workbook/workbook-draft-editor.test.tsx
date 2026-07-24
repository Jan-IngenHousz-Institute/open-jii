import {
  __resetProtocolCodeRegistry,
  registerProtocolCodeSource,
} from "@/lib/protocol-code-registry";
import { act, render, screen, userEvent } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import { WorkbookDraftEditor } from "./workbook-draft-editor";

// A controllable producer: executeProtocolWithDriver stays pending until the
// test resolves it, so an authored edit can land mid-flight.
let pending: { promise: Promise<unknown>; resolve: (value: unknown) => void };
function makePending() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>((r) => {
    resolve = r;
  });
  pending = { promise, resolve };
}

const connection = {
  id: "dev-1",
  label: "Dev 1",
  family: "multispeq" as const,
  identity: { family: "multispeq" as const, name: "Dev 1", raw: {} },
  driver: {},
};

vi.mock("~/hooks/iot/useIotConnections/useIotConnections", () => ({
  useIotConnections: () => ({
    connections: [connection],
    isConnecting: false,
    error: null,
    connect: vi.fn(),
    disconnectDevice: vi.fn(),
    disconnectAll: vi.fn(),
  }),
}));

vi.mock("~/hooks/iot/useIotProtocolExecution/useIotProtocolExecution", () => ({
  executeProtocolWithDriver: (): unknown => pending.promise,
  executeCommandWithDriver: vi.fn(),
}));

// Keep autosave off the network.
vi.mock("@/hooks/workbook/useWorkbookUpdate/useWorkbookUpdate", () => ({
  useWorkbookUpdate: () => ({ mutateAsync: vi.fn().mockResolvedValue({}) }),
}));

vi.mock("@repo/auth/client", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useSession: () => ({ data: { user: { id: "owner" } }, isPending: false }) };
});

// Thin harness: surface the real authored `onCellsChange` and `onRunCell` so the
// test drives the exact editor callbacks WorkbookDraftEditor wires up.
vi.mock("@/components/workbook/workbook-editor", () => ({
  WorkbookEditor: ({
    cells,
    onCellsChange,
    onRunCell,
    onClearOutputs,
  }: {
    cells: WorkbookCell[];
    onCellsChange: (cells: WorkbookCell[]) => void;
    onRunCell?: (id: string) => void;
    onClearOutputs?: () => void;
  }) => (
    <div>
      <div data-testid="ids">
        {cells.map((c) => `${c.id}:${c.type}:${c.isCollapsed ? "c" : "o"}`).join("|")}
      </div>
      <button data-testid="run" onClick={() => onRunCell?.("proto")}>
        run
      </button>
      {/* Clear outputs AND resolve the pending producer in one event: Clear
          invalidates synchronously, so the stale completion commits no output
          and the authored `md` cell is not resurrected/removed. */}
      <button
        data-testid="clear-and-resolve"
        onClick={() => {
          onClearOutputs?.();
          pending.resolve({ value: "late" });
        }}
      >
        clear
      </button>
      {/* Authored edit AND producer resolution in ONE event: the invalidation
          must be synchronous (in this callback) to beat the producer microtask;
          a passive-effect invalidation would run too late. */}
      <button
        data-testid="edit-and-resolve"
        onClick={() => {
          onCellsChange([
            ...cells,
            { id: "md-new", type: "markdown", isCollapsed: false, content: "x" },
          ]);
          pending.resolve({ value: "late" });
        }}
      >
        edit
      </button>
      {/* Collapse (non-invalidating) AND resolve in one event: the producer must
          still commit, and the merge must keep the collapse. */}
      <button
        data-testid="collapse-and-resolve"
        onClick={() => {
          onCellsChange(cells.map((c) => (c.id === "proto" ? { ...c, isCollapsed: true } : c)));
          pending.resolve({ value: "ok" });
        }}
      >
        collapse
      </button>
    </div>
  ),
}));

const PROTOCOL_ID = "11111111-1111-1111-1111-111111111111";
const proto: WorkbookCell = {
  id: "proto",
  type: "protocol",
  isCollapsed: false,
  payload: { protocolId: PROTOCOL_ID, version: 1, name: "Scan" },
};

async function flushMicrotasks() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("WorkbookDraftEditor authored/execution onCellsChange split", () => {
  beforeEach(() => {
    __resetProtocolCodeRegistry();
    makePending();
    // Synchronous live code so the producer reaches the (deferred) executor.
    registerProtocolCodeSource(PROTOCOL_ID, () => [{ _protocol_set_: [] }]);
  });

  it("an authored edit in the same event as the producer resolution wins: no stale commit, edit kept", async () => {
    const user = userEvent.setup();
    render(<WorkbookDraftEditor id="wb-1" initialCells={[proto]} createdBy="owner" name="W" />);

    await user.click(screen.getByTestId("run"));
    // Authored edit + producer resolution in ONE event, before RTL/effects flush.
    // Sync invalidation makes the producer stale so it cannot commit; a passive
    // effect would not have run yet and the producer would win.
    await user.click(screen.getByTestId("edit-and-resolve"));
    await flushMicrotasks();

    // The edit persisted and the stale producer committed no output cell.
    expect(screen.getByTestId("ids").textContent).toBe("proto:protocol:o|md-new:markdown:o");
  });

  it("a collapse in the same event as the producer resolution survives; the producer still commits", async () => {
    const user = userEvent.setup();
    render(<WorkbookDraftEditor id="wb-1" initialCells={[proto]} createdBy="owner" name="W" />);

    await user.click(screen.getByTestId("run"));
    // Collapse is non-invalidating, so the producer still commits; the merge must
    // preserve the collapse rather than the producer's pre-collapse snapshot.
    await user.click(screen.getByTestId("collapse-and-resolve"));
    await flushMicrotasks();

    const ids = screen.getByTestId("ids").textContent;
    // Collapse survived (proto stays "c") AND the producer's output was committed.
    expect(ids).toContain("proto:protocol:c");
    expect(ids).toContain(":output:");
  });

  it("Clear during a pending producer commits no output and does not resurrect authored cells", async () => {
    const user = userEvent.setup();
    const md: WorkbookCell = { id: "md", type: "markdown", isCollapsed: false, content: "note" };
    render(<WorkbookDraftEditor id="wb-1" initialCells={[proto, md]} createdBy="owner" name="W" />);

    await user.click(screen.getByTestId("run"));
    // Clear + producer resolution in one event: Clear invalidates synchronously.
    await user.click(screen.getByTestId("clear-and-resolve"));
    await flushMicrotasks();

    // No output committed by the stale producer; authored cells intact, not dup'd.
    expect(screen.getByTestId("ids").textContent).toBe("proto:protocol:o|md:markdown:o");
  });
});
