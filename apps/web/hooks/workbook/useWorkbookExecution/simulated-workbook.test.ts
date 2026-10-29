import {
  createExperiment,
  createMacroCell,
  createOutputCell,
  createProtocolCell,
  createQuestionCell,
} from "@/test/factories";
import { API_URL } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { act, renderHook } from "@/test/test-utils";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerProtocolCodeSource } from "~/lib/protocol-code-registry";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { getDemoRecording, SIMULATED_SENSOR_FAMILIES } from "@repo/iot/simulation/recordings";

import { useIotConnections } from "../../iot/useIotConnections/useIotConnections";
import { useWorkbookExecution } from "./useWorkbookExecution";

const demo = Object.assign(createExperiment(), { organizationType: "demo" });
afterEach(() => {
  vi.unstubAllEnvs();
  window.history.replaceState({}, "", "/");
});

describe("simulated workbook execution", () => {
  it.each(SIMULATED_SENSOR_FAMILIES)(
    "identifies and executes %s, passing its own family to the macro and labels downstream outputs",
    async (family) => {
      const recording = getDemoRecording(family);
      const protocol = createProtocolCell();
      const macro = createMacroCell();
      const question = createQuestionCell();
      const unregister = registerProtocolCodeSource(
        protocol.payload.protocolId,
        () => recording.protocol,
      );
      const requests: { context?: Record<string, unknown> }[] = [];
      server.use(
        http.post(`${API_URL}/api/v1/macros/:id/execute`, async ({ request }) => {
          requests.push((await request.json()) as { context?: Record<string, unknown> });
          return HttpResponse.json({
            macro_id: macro.payload.macroId,
            success: true,
            output: { Phi2: 0.7 },
          });
        }),
      );
      const hook = renderHook(() => {
        const [cells, setCells] = useState<WorkbookCell[]>([protocol, macro, question]);
        const execution = useWorkbookExecution({
          experiment: demo,
          cells,
          onCellsChange: setCells,
          onPromptQuestion: () => Promise.resolve("answer"),
        });
        return { cells, ...execution };
      });
      try {
        act(() => hook.result.current.setConnectionType(`simulated-${family}`));
        await act(() => hook.result.current.connect());
        expect(hook.result.current.connectedDevices[0]).toMatchObject({
          family,
          stableId: `simulated:${family}`,
          name: recording.measurement.device_name,
        });
        expect(hook.result.current.sensorFamily).toBe("multispeq");
        await act(() => hook.result.current.runAll());
        const outputs = hook.result.current.cells.filter((c) => c.type === "output");
        expect(outputs).toHaveLength(3);
        expect(outputs[0].data).toEqual(recording.measurement);
        expect(outputs[0].deviceResults?.[0]).toMatchObject({
          family,
          simulated: true,
          deviceName: recording.measurement.device_name,
        });
        expect(requests[0].context?.$device).toMatchObject({ family, id: `simulated:${family}` });
        expect(outputs.slice(1).every((c) => c.simulated)).toBe(true);
      } finally {
        hook.unmount();
        unregister();
      }
    },
  );
  it("does not label a real macro input or its following answer from stale simulated outputs", async () => {
    const simulatedProtocol = createProtocolCell();
    const realProtocol = createProtocolCell();
    const macro = createMacroCell();
    const question = createQuestionCell();
    const realData = { Phi2: 0.83 };
    const requests: unknown[] = [];
    server.use(
      http.post(`${API_URL}/api/v1/macros/:id/execute`, async ({ request }) => {
        requests.push(await request.json());
        return HttpResponse.json({
          macro_id: macro.payload.macroId,
          success: true,
          output: realData,
        });
      }),
    );
    const hook = renderHook(() => {
      const [cells, setCells] = useState<WorkbookCell[]>([
        simulatedProtocol,
        createOutputCell({
          producedBy: simulatedProtocol.id,
          data: { Phi2: 0.7 },
          simulated: true,
        }),
        realProtocol,
        createOutputCell({ producedBy: realProtocol.id, data: realData, simulated: false }),
        macro,
        question,
      ]);
      const execution = useWorkbookExecution({
        experiment: demo,
        cells,
        onCellsChange: setCells,
        onPromptQuestion: () => Promise.resolve("real sample"),
      });
      return { cells, ...execution };
    });
    await act(() => hook.result.current.runCell(macro.id));
    await act(() => hook.result.current.runCell(question.id));
    expect(requests[0]).toMatchObject({ data: realData });
    const outputs = hook.result.current.cells.filter((c) => c.type === "output");
    expect(outputs.find((c) => c.producedBy === simulatedProtocol.id)?.simulated).toBe(true);
    expect(outputs.find((c) => c.producedBy === macro.id)?.simulated).toBe(false);
    expect(outputs.find((c) => c.producedBy === question.id)?.simulated).toBe(false);
    hook.unmount();
  });
  it("labels a macro that can read a named simulated output through ctx after a physical protocol", async () => {
    const simulatedProtocol = createProtocolCell({
      payload: { protocolId: crypto.randomUUID(), version: 1, name: "simulated_scan" },
    });
    const realProtocol = createProtocolCell();
    const macro = createMacroCell();
    const question = createQuestionCell();
    const requests: { context?: Record<string, unknown> }[] = [];
    server.use(
      http.post(`${API_URL}/api/v1/macros/:id/execute`, async ({ request }) => {
        requests.push((await request.json()) as { context?: Record<string, unknown> });
        return HttpResponse.json({
          macro_id: macro.payload.macroId,
          success: true,
          output: { Phi2: 0.7 },
        });
      }),
    );
    const hook = renderHook(() => {
      const [cells, setCells] = useState<WorkbookCell[]>([
        simulatedProtocol,
        createOutputCell({
          producedBy: simulatedProtocol.id,
          data: { Phi2: 0.7 },
          simulated: true,
        }),
        realProtocol,
        createOutputCell({ producedBy: realProtocol.id, data: { Phi2: 0.83 }, simulated: false }),
        macro,
        question,
      ]);
      const execution = useWorkbookExecution({
        experiment: demo,
        cells,
        onCellsChange: setCells,
        onPromptQuestion: () => Promise.resolve("sample"),
      });
      return { cells, ...execution };
    });
    await act(() => hook.result.current.runCell(macro.id));
    await act(() => hook.result.current.runCell(question.id));
    expect(requests[0].context).toHaveProperty("simulated_scan");
    const outputs = hook.result.current.cells.filter((c) => c.type === "output");
    expect(outputs.find((c) => c.producedBy === macro.id)?.simulated).toBe(true);
    expect(outputs.find((c) => c.producedBy === question.id)?.simulated).toBe(true);
    hook.unmount();
  });
  it("labels each per-device macro run from the named outputs that device can read", async () => {
    const scan = createProtocolCell({
      payload: { protocolId: crypto.randomUUID(), version: 1, name: "scan" },
    });
    const realProtocol = createProtocolCell();
    const macro = createMacroCell();
    const device = (deviceId: string, simulated: boolean) => ({
      deviceId,
      deviceLabel: deviceId,
      family: "multispeq" as const,
      simulated,
      data: { Phi2: 0.8 },
    });
    server.use(
      http.post(`${API_URL}/api/v1/macros/:id/execute`, () =>
        HttpResponse.json({ macro_id: macro.payload.macroId, success: true, output: { ok: 1 } }),
      ),
    );
    const hook = renderHook(() => {
      const [cells, setCells] = useState<WorkbookCell[]>([
        scan,
        createOutputCell({
          producedBy: scan.id,
          data: { Phi2: 0.8 },
          deviceResults: [device("a", true), device("b", false)],
        }),
        realProtocol,
        createOutputCell({
          producedBy: realProtocol.id,
          data: { Phi2: 0.8 },
          deviceResults: [device("a", false), device("b", false)],
        }),
        macro,
      ]);
      const execution = useWorkbookExecution({ experiment: demo, cells, onCellsChange: setCells });
      return { cells, ...execution };
    });
    await act(() => hook.result.current.runCell(macro.id));
    const output = hook.result.current.cells.find(
      (c) => c.type === "output" && c.producedBy === macro.id,
    );
    expect(output?.type === "output" && output.deviceResults).toEqual([
      expect.objectContaining({ deviceId: "a", simulated: true, data: { ok: 1 } }),
      expect.objectContaining({ deviceId: "b", simulated: undefined, data: { ok: 1 } }),
    ]);
    hook.unmount();
  });
  it("enables production demo simulation with developer flags off, and disables non-demo simulation with them on", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_MOCK_DEVICES", "false");
    const hook = renderHook(({ experiment }) => useIotConnections("multispeq", { experiment }), {
      initialProps: { experiment: demo },
    });
    expect(hook.result.current.simulationAvailable).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_ENABLE_MOCK_DEVICES", "true");
    window.history.replaceState({}, "", "/?mockDevices=multispeq");
    hook.rerender({
      experiment: Object.assign(createExperiment(), { organizationType: "university" }),
    });
    expect(hook.result.current.simulationAvailable).toBe(false);
    hook.unmount();
  });
  it("removes simulated connections when the experiment changes", async () => {
    const hook = renderHook(({ experiment }) => useIotConnections("multispeq", { experiment }), {
      initialProps: { experiment: demo },
    });
    await act(() => hook.result.current.connect("simulated-multispeq"));
    expect(hook.result.current.connections).toHaveLength(1);
    hook.rerender({
      experiment: Object.assign(createExperiment(), { organizationType: "university" }),
    });
    expect(hook.result.current.connections).toEqual([]);
    hook.unmount();
  });
});
