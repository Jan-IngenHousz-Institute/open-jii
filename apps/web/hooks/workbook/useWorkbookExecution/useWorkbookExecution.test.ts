import {
  createBranchCell,
  createMacroCell,
  createMarkdownCell,
  createOutputCell,
  createProtocol,
  createProtocolCell,
  createQuestionCell,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, act, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  __resetProtocolCodeRegistry,
  registerProtocolCodeSource,
} from "~/lib/protocol-code-registry";

import { contract } from "@repo/api/contract";
import type { QuestionCell, WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

import { useWorkbookExecution } from "./useWorkbookExecution";

const mockExecuteProtocol = vi.fn();
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();

let mockIsConnected = false;

vi.mock("~/hooks/iot/useIotCommunication/useIotCommunication", () => ({
  useIotCommunication: () => ({
    isConnected: mockIsConnected,
    isConnecting: false,
    error: null,
    deviceInfo: null,
    driver: null,
    connect: mockConnect,
    disconnect: mockDisconnect,
  }),
}));

vi.mock("~/hooks/iot/useIotProtocolExecution/useIotProtocolExecution", () => ({
  useIotProtocolExecution: () => ({
    executeProtocol: mockExecuteProtocol,
  }),
}));

function renderExecution(
  cells: WorkbookCell[],
  overrides: Partial<Parameters<typeof useWorkbookExecution>[0]> = {},
) {
  const onCellsChange = vi.fn();
  const result = renderHook(
    (props: { cells: WorkbookCell[] }) =>
      useWorkbookExecution({
        cells: props.cells,
        onCellsChange,
        ...overrides,
      }),
    { initialProps: { cells } },
  );
  return { ...result, onCellsChange };
}

function lastPushed(onCellsChange: ReturnType<typeof vi.fn>): WorkbookCell[] {
  const calls = onCellsChange.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0] as WorkbookCell[];
}

function findOutput(cells: WorkbookCell[], producedBy?: string) {
  const output = cells.find(
    (c) => c.type === "output" && (producedBy ? c.producedBy === producedBy : true),
  );
  if (output?.type !== "output") return undefined;
  return output;
}

describe("useWorkbookExecution", () => {
  beforeEach(() => {
    mockIsConnected = false;
    mockExecuteProtocol.mockReset();
    mockConnect.mockReset();
    mockDisconnect.mockReset();
    __resetProtocolCodeRegistry();
  });

  it("clearOutputs removes all output cells", () => {
    const proto = createProtocolCell();
    const output = createOutputCell({ producedBy: proto.id });
    const macro = createMacroCell();
    const cells: WorkbookCell[] = [proto, output, macro];

    const { result, onCellsChange } = renderExecution(cells);

    act(() => result.current.clearOutputs());

    const updated = lastPushed(onCellsChange);
    expect(updated.every((c) => c.type !== "output")).toBe(true);
    expect(updated).toHaveLength(2);
    expect(result.current.executionStates).toEqual({});
  });

  describe("runCell - protocol", () => {
    it("errors when protocol has no code", async () => {
      const proto = createProtocolCell();
      const protocol = createProtocol({
        id: proto.payload.protocolId,
        code: [],
      });
      server.mount(contract.protocols.getProtocol, { body: protocol });

      const { result, onCellsChange } = renderExecution([proto]);

      await act(() => result.current.runCell(proto.id));

      const outputCell = findOutput(lastPushed(onCellsChange));
      expect(outputCell).toBeDefined();
      expect(outputCell?.messages).toContain("Invalid or missing protocol code");
      expect(result.current.executionStates[proto.id].status).toBe("error");
    });

    it("errors when no device is connected", async () => {
      const proto = createProtocolCell();
      const protocol = createProtocol({
        id: proto.payload.protocolId,
        code: [{ _protocol_set_: [] }],
      });
      server.mount(contract.protocols.getProtocol, { body: protocol });
      mockIsConnected = false;

      const { result, onCellsChange } = renderExecution([proto]);

      await act(() => result.current.runCell(proto.id));

      const outputCell = findOutput(lastPushed(onCellsChange));
      expect(outputCell?.messages).toEqual(
        expect.arrayContaining([expect.stringContaining("No device connected")]),
      );
    });

    it("executes protocol and produces output cell", async () => {
      const proto = createProtocolCell();
      const protocol = createProtocol({
        id: proto.payload.protocolId,
        code: [{ _protocol_set_: [] }],
      });
      server.mount(contract.protocols.getProtocol, { body: protocol });
      mockIsConnected = true;
      mockExecuteProtocol.mockResolvedValue({ measurement: 42 });

      const { result, onCellsChange } = renderExecution([proto]);

      await act(() => result.current.runCell(proto.id));

      const outputCell = findOutput(lastPushed(onCellsChange));
      expect(outputCell?.data).toEqual({ measurement: 42 });
      expect(outputCell?.producedBy).toBe(proto.id);
      expect(result.current.executionStates[proto.id].status).toBe("completed");
    });

    it("runs the live editor code directly, without re-fetching from the server", async () => {
      // Fixes the stale-protocol bug at the source: the device runs exactly the
      // code currently in the editor, with no backend round-trip - so a debounced,
      // not-yet-saved edit is never bypassed in favour of an older saved version.
      const proto = createProtocolCell();
      const liveCode = [{ _protocol_set_: [{ label: "live" }] }];

      // The server holds a different (older) version that must NOT be read.
      const getProtocolSpy = server.mount(contract.protocols.getProtocol, {
        body: createProtocol({
          id: proto.payload.protocolId,
          code: [{ _protocol_set_: [{ label: "old" }] }],
        }),
      });
      mockIsConnected = true;
      mockExecuteProtocol.mockResolvedValue({ measurement: 1 });

      registerProtocolCodeSource(proto.payload.protocolId, () => liveCode);

      const { result } = renderExecution([proto]);

      await act(() => result.current.runCell(proto.id));

      expect(mockExecuteProtocol).toHaveBeenCalledWith(liveCode);
      expect(getProtocolSpy.called).toBe(false);
    });

    it("falls back to fetching the saved protocol when no editor is mounted", async () => {
      const proto = createProtocolCell();
      const savedCode = [{ _protocol_set_: [{ label: "saved" }] }];
      server.mount(contract.protocols.getProtocol, {
        body: createProtocol({ id: proto.payload.protocolId, code: savedCode }),
      });
      mockIsConnected = true;
      mockExecuteProtocol.mockResolvedValue({ measurement: 1 });

      // No code source registered - e.g. the cell's editor is not mounted.
      const { result } = renderExecution([proto]);

      await act(() => result.current.runCell(proto.id));

      expect(mockExecuteProtocol).toHaveBeenCalledWith(savedCode);
    });

    it("captures protocol execution errors", async () => {
      const proto = createProtocolCell();
      const protocol = createProtocol({
        id: proto.payload.protocolId,
        code: [{ _protocol_set_: [] }],
      });
      server.mount(contract.protocols.getProtocol, { body: protocol });
      mockIsConnected = true;
      mockExecuteProtocol.mockRejectedValue(new Error("Device timed out"));

      const { result, onCellsChange } = renderExecution([proto]);

      await act(() => result.current.runCell(proto.id));

      const outputCell = findOutput(lastPushed(onCellsChange));
      expect(outputCell?.messages).toContain("Device timed out");
      expect(result.current.executionStates[proto.id].error).toBe("Device timed out");
    });

    it("re-running a protocol replaces its previous output cell", async () => {
      const proto = createProtocolCell();
      server.mount(contract.protocols.getProtocol, {
        body: createProtocol({ id: proto.payload.protocolId, code: [{ _protocol_set_: [] }] }),
      });
      mockIsConnected = true;
      mockExecuteProtocol.mockResolvedValueOnce({ run: 1 }).mockResolvedValueOnce({ run: 2 });

      const { result, onCellsChange } = renderExecution([proto]);

      await act(() => result.current.runCell(proto.id));
      await act(() => result.current.runCell(proto.id));

      const updated = lastPushed(onCellsChange);
      const outputs = updated.filter((c) => c.type === "output");
      expect(outputs).toHaveLength(1);
      expect(findOutput(updated, proto.id)?.data).toEqual({ run: 2 });
    });
  });

  describe("runCell - macro", () => {
    it("errors when no preceding output data", async () => {
      const macro = createMacroCell();
      const { result, onCellsChange } = renderExecution([macro]);

      await act(() => result.current.runCell(macro.id));

      const outputCell = findOutput(lastPushed(onCellsChange));
      expect(outputCell?.messages).toEqual(
        expect.arrayContaining([expect.stringContaining("No measurement data available")]),
      );
      expect(result.current.executionStates[macro.id].status).toBe("error");
    });

    it("executes macro against the preceding protocol's persisted output", async () => {
      const proto = createProtocolCell();
      const output = createOutputCell({
        producedBy: proto.id,
        data: { chlorophyll: 35 },
      });
      const macro = createMacroCell();

      const executeSpy = server.mount(contract.macros.executeMacro, {
        body: {
          macro_id: macro.payload.macroId,
          success: true,
          output: { result: 99 },
        },
      });

      const { result, onCellsChange } = renderExecution([proto, output, macro]);

      await act(() => result.current.runCell(macro.id));

      const macroOutput = findOutput(lastPushed(onCellsChange), macro.id);
      expect(macroOutput?.data).toEqual({ result: 99 });
      expect(executeSpy.body).toEqual({ data: { chlorophyll: 35 } });
    });

    it("captures macro failure response", async () => {
      const proto = createProtocolCell();
      const output = createOutputCell({
        producedBy: proto.id,
        data: { value: 1 },
      });
      const macro = createMacroCell();

      server.mount(contract.macros.executeMacro, {
        body: {
          macro_id: macro.payload.macroId,
          success: false,
          error: "Division by zero",
        },
      });

      const { result, onCellsChange } = renderExecution([proto, output, macro]);

      await act(() => result.current.runCell(macro.id));

      const macroOutput = findOutput(lastPushed(onCellsChange), macro.id);
      expect(macroOutput?.messages).toContain("Division by zero");
    });

    it("feeds a fresh protocol run into a macro run across rerenders", async () => {
      const proto = createProtocolCell();
      const macro = createMacroCell();
      server.mount(contract.protocols.getProtocol, {
        body: createProtocol({ id: proto.payload.protocolId, code: [{ _protocol_set_: [] }] }),
      });
      mockIsConnected = true;
      mockExecuteProtocol.mockResolvedValue({ spad: 7 });
      const executeSpy = server.mount(contract.macros.executeMacro, {
        body: { macro_id: macro.payload.macroId, success: true, output: { ok: true } },
      });

      const { result, onCellsChange, rerender } = renderExecution([proto, macro]);

      await act(() => result.current.runCell(proto.id));

      // Parent commits the pushed cells (output folded in), then the macro runs.
      rerender({ cells: lastPushed(onCellsChange) });
      await act(() => result.current.runCell(macro.id));

      expect(executeSpy.body).toEqual({ data: { spad: 7 } });
    });
  });

  describe("runCell - question", () => {
    it("does not produce output without a prompt function", async () => {
      const q = createQuestionCell();
      const { result, onCellsChange } = renderExecution([q]);

      await act(() => result.current.runCell(q.id));

      // Nothing to fold back: no push at all.
      expect(onCellsChange).not.toHaveBeenCalled();
    });

    it("prompts, records the answer and completes the cell", async () => {
      const q = createQuestionCell();
      const onPrompt = vi.fn().mockResolvedValue("42");

      const { result } = renderExecution([q], {
        onPromptQuestion: onPrompt,
      });

      await act(() => result.current.runCell(q.id));

      expect(onPrompt).toHaveBeenCalledWith(q);
      expect(result.current.executionStates[q.id].status).toBe("completed");
      expect(result.current.executionStates[q.id].executionOrder).toEqual([1]);
    });

    it("does not record a run when user cancels the prompt", async () => {
      const q = createQuestionCell();
      const onPrompt = vi.fn().mockResolvedValue(undefined);

      const { result, onCellsChange } = renderExecution([q], {
        onPromptQuestion: onPrompt,
      });

      await act(() => result.current.runCell(q.id));

      expect(onPrompt).toHaveBeenCalledTimes(1);
      expect(onCellsChange).not.toHaveBeenCalled();
      expect(result.current.executionStates[q.id]).toBeUndefined();
    });

    it("marks the prompted question as running while the prompt is open", async () => {
      const q = createQuestionCell();
      let resolvePrompt: ((answer: string | undefined) => void) | undefined;
      const onPrompt = vi.fn().mockImplementation(
        () =>
          new Promise<string | undefined>((resolve) => {
            resolvePrompt = resolve;
          }),
      );

      const { result } = renderExecution([q], { onPromptQuestion: onPrompt });

      let done: Promise<void> | undefined;
      act(() => {
        done = result.current.runCell(q.id);
      });

      await waitFor(() =>
        expect(result.current.executionStates[q.id]).toMatchObject({ status: "running" }),
      );

      await act(async () => {
        resolvePrompt?.("yes");
        await done;
      });

      expect(result.current.executionStates[q.id].status).toBe("completed");
    });
  });

  describe("runCell - branch", () => {
    it("evaluates branch from a persisted answer and records matched path", async () => {
      const q = createQuestionCell({
        id: "q-1",
        answer: "yes",
        isAnswered: true,
      });
      const branch = createBranchCell({
        id: "branch-1",
        paths: [
          {
            id: "path-yes",
            label: "Yes path",
            color: "#22c55e",
            conditions: [
              {
                id: "cond-1",
                sourceCellId: "q-1",
                field: "answer",
                operator: "eq",
                value: "yes",
              },
            ],
          },
        ],
      });

      const cells: WorkbookCell[] = [q, branch];
      const { result, onCellsChange } = renderExecution(cells);

      await act(() => result.current.runCell(branch.id));

      const updated = lastPushed(onCellsChange);
      const updatedBranch = updated.find((c) => c.id === "branch-1");
      expect(updatedBranch).toHaveProperty("evaluatedPathId", "path-yes");

      const outputCell = findOutput(updated, "branch-1");
      expect(outputCell?.messages).toEqual(
        expect.arrayContaining([expect.stringContaining("Yes path")]),
      );
    });

    it("reports no match for a branch whose conditions do not hold", async () => {
      const branch = createBranchCell({
        paths: [
          {
            id: "bad-path",
            label: "Bad",
            color: "#f00",
            conditions: [
              {
                id: "cond-1",
                sourceCellId: "",
                field: "",
                operator: "eq",
                value: "",
              },
            ],
          },
        ],
      });

      const { result, onCellsChange } = renderExecution([branch]);

      await act(() => result.current.runCell(branch.id));

      const updated = lastPushed(onCellsChange);
      const outputCell = findOutput(updated, branch.id);
      expect(outputCell?.messages).toEqual(["No path matched"]);
      const updatedBranch = updated.find((c) => c.id === branch.id);
      expect((updatedBranch as { evaluatedPathId?: string }).evaluatedPathId).toBeUndefined();
    });

    it("follows a branch jump and runs the cells from the target", async () => {
      const q = createQuestionCell({ id: "q-1", answer: "yes", isAnswered: true });
      const target = createQuestionCell({ id: "q-target", name: "target_q" });
      const branch = createBranchCell({
        id: "branch-1",
        paths: [
          {
            id: "path-yes",
            label: "Yes path",
            color: "#22c55e",
            conditions: [
              { id: "cond-1", sourceCellId: "q-1", field: "answer", operator: "eq", value: "yes" },
            ],
            gotoCellId: "q-target",
          },
        ],
      });
      const onPrompt = vi.fn().mockResolvedValue("landed");

      const { result } = renderExecution([q, branch, target], { onPromptQuestion: onPrompt });

      await act(() => result.current.runCell(branch.id));

      expect(onPrompt).toHaveBeenCalledTimes(1);
      expect(onPrompt).toHaveBeenCalledWith(target);
    });
  });

  describe("runAll", () => {
    it("skips output and markdown cells", async () => {
      const q = createQuestionCell();
      const output = createOutputCell({ producedBy: q.id });
      const onPrompt = vi.fn().mockResolvedValue("answer");

      const cells: WorkbookCell[] = [q, output, createMarkdownCell({ content: "# Notes" })];

      const { result } = renderExecution(cells, {
        onPromptQuestion: onPrompt,
      });

      await act(() => result.current.runAll());

      expect(onPrompt).toHaveBeenCalledTimes(1);
    });

    it("executes cells sequentially and tracks running state", async () => {
      const q1 = createQuestionCell({ id: "q-1" });
      const q2 = createQuestionCell({ id: "q-2" });
      const callOrder: string[] = [];

      const onPrompt = vi.fn().mockImplementation((cell: QuestionCell) => {
        callOrder.push(cell.id);
        return Promise.resolve("done");
      });

      const { result } = renderExecution([q1, q2], {
        onPromptQuestion: onPrompt,
      });

      expect(result.current.isRunningAll).toBe(false);
      await act(() => result.current.runAll());
      expect(result.current.isRunningAll).toBe(false);

      expect(callOrder).toEqual(["q-1", "q-2"]);
    });

    it("ends the pass at a question whose prompt is dismissed", async () => {
      const q1 = createQuestionCell({ id: "q-1" });
      const q2 = createQuestionCell({ id: "q-2" });
      const onPrompt = vi.fn().mockResolvedValue(undefined);

      const { result } = renderExecution([q1, q2], {
        onPromptQuestion: onPrompt,
      });

      await act(() => result.current.runAll());

      expect(onPrompt).toHaveBeenCalledTimes(1);
      expect(result.current.isRunningAll).toBe(false);
    });
  });

  describe("stopExecution", () => {
    it("stops runAll after the current cell finishes", async () => {
      const q1 = createQuestionCell({ id: "q-1" });
      const q2 = createQuestionCell({ id: "q-2" });

      const hookResultRef = { current: null as ReturnType<typeof useWorkbookExecution> | null };
      const onPrompt = vi.fn().mockImplementation((cell: QuestionCell) => {
        if (cell.id === "q-1") {
          hookResultRef.current?.stopExecution();
        }
        return Promise.resolve("answered");
      });

      const { result } = renderExecution([q1, q2], {
        onPromptQuestion: onPrompt,
      });
      hookResultRef.current = result.current;

      await act(() => result.current.runAll());

      expect(onPrompt).toHaveBeenCalledTimes(1);
    });
  });

  describe("execution order", () => {
    it("stamps sequential execution order numbers", async () => {
      const q1 = createQuestionCell({ id: "q-1" });
      const q2 = createQuestionCell({ id: "q-2" });
      const onPrompt = vi.fn().mockResolvedValue("ok");

      const { result } = renderExecution([q1, q2], {
        onPromptQuestion: onPrompt,
      });

      await act(() => result.current.runAll());

      const states = result.current.executionStates;
      expect(states["q-1"].executionOrder).toEqual([1]);
      expect(states["q-2"].executionOrder).toEqual([2]);
    });

    it("preserves execution records across cell edits", async () => {
      const q1 = createQuestionCell({ id: "q-1" });
      const onPrompt = vi.fn().mockResolvedValue("ok");

      const { result, rerender } = renderExecution([q1], { onPromptQuestion: onPrompt });

      await act(() => result.current.runCell(q1.id));
      expect(result.current.executionStates["q-1"].status).toBe("completed");

      // Edit the workbook (new array identity), then run again: counters continue.
      const edited: WorkbookCell[] = [q1, createMarkdownCell({ content: "note" })];
      rerender({ cells: edited });
      await act(() => result.current.runCell(q1.id));

      expect(result.current.executionStates["q-1"].executionOrder).toEqual([1, 2]);
    });
  });

  describe("connection", () => {
    it("exposes device connection state", () => {
      const { result } = renderExecution([]);

      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
    });

    it("exposes connect and disconnect from IoT hook", () => {
      const { result } = renderExecution([]);

      expect(result.current.connect).toBe(mockConnect);
      expect(result.current.disconnect).toBe(mockDisconnect);
    });

    it("defaults sensor family to multispeq", () => {
      const { result } = renderExecution([]);

      expect(result.current.sensorFamily).toBe("multispeq");
    });

    it("allows changing sensor family", () => {
      const { result } = renderExecution([]);

      act(() => result.current.setSensorFamily("ambit"));

      expect(result.current.sensorFamily).toBe("ambit");
    });
  });
});
