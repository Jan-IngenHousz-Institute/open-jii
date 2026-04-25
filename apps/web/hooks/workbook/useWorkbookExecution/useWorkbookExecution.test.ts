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
import { renderHook, act } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { QuestionCell, WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import { contract } from "@repo/api/contract";

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
  const result = renderHook(() =>
    useWorkbookExecution({
      cells,
      onCellsChange,
      ...overrides,
    }),
  );
  return { ...result, onCellsChange };
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
  });

  it("clearOutputs removes all output cells", () => {
    const proto = createProtocolCell();
    const output = createOutputCell({ producedBy: proto.id });
    const macro = createMacroCell();
    const cells: WorkbookCell[] = [proto, output, macro];

    const { result, onCellsChange } = renderExecution(cells);

    act(() => result.current.clearOutputs());

    const updated = onCellsChange.mock.calls[0][0] as WorkbookCell[];
    expect(updated.every((c) => c.type !== "output")).toBe(true);
    expect(updated).toHaveLength(2);
  });

  describe("runCell — protocol", () => {
    it("errors when protocol has no code", async () => {
      const proto = createProtocolCell();
      const protocol = createProtocol({
        id: proto.payload.protocolId,
        code: [],
      });
      server.mount(contract.protocols.getProtocol, { body: protocol });

      const { result, onCellsChange } = renderExecution([proto]);

      await act(() => result.current.runCell(proto.id));

      const updated = onCellsChange.mock.calls[0][0] as WorkbookCell[];
      const outputCell = findOutput(updated);
      expect(outputCell).toBeDefined();
      expect(outputCell?.messages).toContain("Invalid or missing protocol JSON");
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

      const updated = onCellsChange.mock.calls[0][0] as WorkbookCell[];
      const outputCell = findOutput(updated);
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

      const updated = onCellsChange.mock.calls[0][0] as WorkbookCell[];
      const outputCell = findOutput(updated);
      expect(outputCell?.data).toEqual({ measurement: 42 });
      expect(outputCell?.producedBy).toBe(proto.id);
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

      const updated = onCellsChange.mock.calls[0][0] as WorkbookCell[];
      const outputCell = findOutput(updated);
      expect(outputCell?.messages).toContain("Device timed out");
    });
  });

  describe("runCell — macro", () => {
    it("errors when no preceding output data", async () => {
      const macro = createMacroCell();
      const { result, onCellsChange } = renderExecution([macro]);

      await act(() => result.current.runCell(macro.id));

      const updated = onCellsChange.mock.calls[0][0] as WorkbookCell[];
      const outputCell = findOutput(updated);
      expect(outputCell?.messages).toEqual(
        expect.arrayContaining([expect.stringContaining("No measurement data available")]),
      );
    });

    it("executes macro with preceding output data", async () => {
      const proto = createProtocolCell();
      const output = createOutputCell({
        producedBy: proto.id,
        data: { chlorophyll: 35 },
      });
      const macro = createMacroCell();

      server.mount(contract.macros.executeMacro, {
        body: {
          macro_id: macro.payload.macroId,
          success: true,
          output: { result: 99 },
        },
      });

      const { result, onCellsChange } = renderExecution([proto, output, macro]);

      await act(() => result.current.runCell(macro.id));

      const updated = onCellsChange.mock.calls[0][0] as WorkbookCell[];
      const macroOutput = findOutput(updated, macro.id);
      expect(macroOutput?.data).toEqual({ result: 99 });
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

      const updated = onCellsChange.mock.calls[0][0] as WorkbookCell[];
      const macroOutput = findOutput(updated, macro.id);
      expect(macroOutput?.messages).toContain("Division by zero");
    });
  });

  describe("runCell — question", () => {
    it("errors when question text is empty", async () => {
      const q = createQuestionCell({
        question: { kind: "open_ended", text: "", required: false },
      });

      const { result, onCellsChange } = renderExecution([q]);

      await act(() => result.current.runCell(q.id));

      const updated = onCellsChange.mock.calls[0][0] as WorkbookCell[];
      const outputCell = findOutput(updated);
      expect(outputCell?.messages).toEqual(
        expect.arrayContaining([expect.stringContaining("Question text is required")]),
      );
    });

    it("does not add output without a prompt function", async () => {
      const q = createQuestionCell();
      const { result, onCellsChange } = renderExecution([q]);

      await act(() => result.current.runCell(q.id));

      const updated = onCellsChange.mock.calls[0][0] as WorkbookCell[];
      expect(findOutput(updated)).toBeUndefined();
    });

    it("records the answer and produces output", async () => {
      const q = createQuestionCell();
      const onPrompt = vi.fn().mockResolvedValue("42");

      const { result, onCellsChange } = renderExecution([q], {
        onPromptQuestion: onPrompt,
      });

      await act(() => result.current.runCell(q.id));

      expect(onPrompt).toHaveBeenCalledWith(q);
      const updated = onCellsChange.mock.calls[0][0] as WorkbookCell[];
      const answeredQ = updated.find((c) => c.id === q.id);
      expect(answeredQ).toHaveProperty("answer", "42");
      expect(answeredQ).toHaveProperty("isAnswered", true);

      const outputCell = findOutput(updated);
      expect(outputCell?.data).toEqual({ answer: "42" });
    });

    it("does not add output when user cancels the prompt", async () => {
      const q = createQuestionCell();
      const onPrompt = vi.fn().mockResolvedValue(undefined);

      const { result, onCellsChange } = renderExecution([q], {
        onPromptQuestion: onPrompt,
      });

      await act(() => result.current.runCell(q.id));

      const updated = onCellsChange.mock.calls[0][0] as WorkbookCell[];
      expect(findOutput(updated)).toBeUndefined();
    });
  });

  describe("runCell — branch", () => {
    it("evaluates branch and records matched path", async () => {
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

      const updated = onCellsChange.mock.calls[0][0] as WorkbookCell[];
      const updatedBranch = updated.find((c) => c.id === "branch-1");
      expect(updatedBranch).toHaveProperty("evaluatedPathId", "path-yes");

      const outputCell = findOutput(updated);
      expect(outputCell?.messages).toEqual(
        expect.arrayContaining([expect.stringContaining("Yes path")]),
      );
    });

    it("reports validation errors for misconfigured branch", async () => {
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

      const updated = onCellsChange.mock.calls[0][0] as WorkbookCell[];
      const outputCell = findOutput(updated);
      expect(outputCell?.messages?.length).toBeGreaterThan(0);
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

      // Only the question cell triggers the prompt — output and markdown are skipped
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

      // q2 should never be prompted because we stopped after q1
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
  });

  describe("connection", () => {
    it("exposes device connection state", () => {
      const { result } = renderExecution([]);

      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.connectionError).toBeNull();
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
