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
    const device = (deviceId: string, Phi2: number, simulated?: boolean) => ({
      deviceId,
      deviceLabel: deviceId,
      family: "multispeq" as const,
      simulated,
      data: { Phi2 },
    });
    const requests: { data: unknown; context?: Record<string, unknown> }[] = [];
    server.use(
      http.post(`${API_URL}/api/v1/macros/:id/execute`, async ({ request }) => {
        requests.push((await request.json()) as (typeof requests)[number]);
        return HttpResponse.json({ macro_id: macro.payload.macroId, success: true, output: {} });
      }),
    );
    const hook = renderHook(() => {
      const [cells, setCells] = useState<WorkbookCell[]>([
        scan,
        createOutputCell({
          producedBy: scan.id,
          data: { Phi2: 0.1 },
          deviceResults: [device("a", 0.1, true), device("b", 0.2)],
        }),
        realProtocol,
        createOutputCell({
          producedBy: realProtocol.id,
          data: { Phi2: 0.3 },
          deviceResults: [device("a", 0.3), device("b", 0.4)],
        }),
        macro,
      ]);
      const execution = useWorkbookExecution({ experiment: demo, cells, onCellsChange: setCells });
      return { cells, ...execution };
    });
    await act(() => hook.result.current.runCell(macro.id));
    expect(requests).toEqual([
      expect.objectContaining({ data: { Phi2: 0.3 }, context: { scan: { Phi2: 0.1 } } }),
      expect.objectContaining({ data: { Phi2: 0.4 }, context: { scan: { Phi2: 0.2 } } }),
    ]);
    const output = hook.result.current.cells.find(
      (c) => c.type === "output" && c.producedBy === macro.id,
    );
    expect(output?.type === "output" && output.deviceResults).toEqual([
      expect.objectContaining({ deviceId: "a", simulated: true }),
      expect.objectContaining({ deviceId: "b", simulated: undefined }),
    ]);
    hook.unmount();
  });
  it.each([
    ["a physical single-device output", ["physical"]],
    ["a fan-out input whose devices are no longer connected", ["gone-a", "gone-b"]],
  ])(
    "labels a macro simulated when the simulator supplies $device for %s",
    async (_, deviceIds) => {
      const protocol = createProtocolCell();
      const macro = createMacroCell();
      const requests: { context?: Record<string, unknown> }[] = [];
      server.use(
        http.post(`${API_URL}/api/v1/macros/:id/execute`, async ({ request }) => {
          requests.push((await request.json()) as (typeof requests)[number]);
          return HttpResponse.json({ macro_id: macro.payload.macroId, success: true, output: {} });
        }),
      );
      const hook = renderHook(() => {
        const [cells, setCells] = useState<WorkbookCell[]>([
          protocol,
          createOutputCell({
            producedBy: protocol.id,
            data: { Phi2: 0.8 },
            deviceResults: deviceIds.map((deviceId) => ({ deviceId, data: { Phi2: 0.8 } })),
          }),
          macro,
        ]);
        const execution = useWorkbookExecution({
          experiment: demo,
          cells,
          onCellsChange: setCells,
        });
        return { cells, ...execution };
      });
      act(() => hook.result.current.setConnectionType("simulated-multispeq"));
      await act(() => hook.result.current.connect());
      await act(() => hook.result.current.runCell(macro.id));
      expect(requests).toHaveLength(deviceIds.length);
      for (const request of requests) {
        expect(request.context?.$device).toMatchObject({ id: "simulated:multispeq" });
      }
      const output = hook.result.current.cells.find(
        (c) => c.type === "output" && c.producedBy === macro.id,
      );
      expect(output?.type === "output" && output.deviceResults?.map((r) => r.simulated)).toEqual(
        deviceIds.map(() => true),
      );
      hook.unmount();
    },
  );
  it("keeps a simulated answer's provenance through Clear outputs", async () => {
    const protocol = createProtocolCell();
    const question = createQuestionCell();
    const macro = createMacroCell();
    const requests: { context?: Record<string, unknown> }[] = [];
    server.use(
      http.post(`${API_URL}/api/v1/macros/:id/execute`, async ({ request }) => {
        requests.push((await request.json()) as (typeof requests)[number]);
        return HttpResponse.json({ macro_id: macro.payload.macroId, success: true, output: {} });
      }),
    );
    const hook = renderHook(() => {
      const [cells, setCells] = useState<WorkbookCell[]>([
        protocol,
        createOutputCell({ producedBy: protocol.id, data: { Phi2: 0.7 }, simulated: true }),
        question,
        macro,
      ]);
      const execution = useWorkbookExecution({
        experiment: demo,
        cells,
        onCellsChange: setCells,
        onPromptQuestion: () => Promise.resolve("leaf 3"),
      });
      return { cells, ...execution };
    });
    await act(() => hook.result.current.runCell(question.id));
    act(() => hook.result.current.clearOutputs());
    expect(hook.result.current.cells.some((c) => c.type === "output")).toBe(false);
    await act(() => hook.result.current.runCell(macro.id));
    expect(requests[0].context).toMatchObject({ [question.name]: { answer: "leaf 3" } });
    expect(hook.result.current.cells.find((c) => c.id === question.id)).toMatchObject({
      answer: "leaf 3",
      simulated: true,
    });
    const output = hook.result.current.cells.find(
      (c) => c.type === "output" && c.producedBy === macro.id,
    );
    expect(output?.type === "output" && output.simulated).toBe(true);
    hook.unmount();
  });
  it.each([
    ["sends a published version's id with its macro runs", "8a3b8a2e-5c1f-4d2b-9f3e-1a2b3c4d5e6f"],
    ["sends no version id with draft macro runs", undefined],
  ])("%s", async (_, workbookVersionId) => {
    const protocol = createProtocolCell();
    const macro = createMacroCell();
    const requests: { workbookVersionId?: string }[] = [];
    server.use(
      http.post(`${API_URL}/api/v1/macros/:id/execute`, async ({ request }) => {
        requests.push((await request.json()) as { workbookVersionId?: string });
        return HttpResponse.json({ macro_id: macro.payload.macroId, success: true, output: {} });
      }),
    );
    const hook = renderHook(() => {
      const [cells, setCells] = useState<WorkbookCell[]>([
        protocol,
        createOutputCell({ producedBy: protocol.id, data: { Phi2: 0.7 } }),
        macro,
      ]);
      return useWorkbookExecution({
        experiment: demo,
        workbookVersionId,
        cells,
        onCellsChange: setCells,
      });
    });
    await act(() => hook.result.current.runCell(macro.id));
    expect(requests).toHaveLength(1);
    expect(requests[0].workbookVersionId).toBe(workbookVersionId);
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
