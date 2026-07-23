import { act, render, screen } from "@testing-library/react-native";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import type { AnalysisContent, FlowNode } from "~/shared/measurements/flow-node";
import type { Device } from "~/shared/types/device";

import { AnalysisNode } from "./analysis-node";

// Mock only the network/native edges and the heavy child components. The node
// itself runs unmocked so its experiment-name resolution executes for real;
// summaryProps captures the name the node hands to the summary card.
const {
  summaryProps,
  macroResultProps,
  actionBarProps,
  useExperiments,
  useSession,
  useMeasurementUpload,
  useMeasurements,
  getSyncedUtcISO,
  getSyncedLocalISO,
  getTimeSyncState,
  scannerExecutors,
} = vi.hoisted(() => ({
  summaryProps: vi.fn(),
  macroResultProps: vi.fn(),
  actionBarProps: vi.fn(),
  useExperiments: vi.fn(),
  useSession: vi.fn(),
  useMeasurementUpload: vi.fn(),
  useMeasurements: vi.fn(),
  getSyncedUtcISO: vi.fn(),
  getSyncedLocalISO: vi.fn(),
  getTimeSyncState: vi.fn(),
  scannerExecutors: {
    current: new Map<string, { device: Device; identity: undefined }>(),
  },
}));

vi.mock("~/features/experiments/hooks/use-experiments", () => ({
  useExperiments: () => useExperiments(),
}));
vi.mock("~/features/auth/hooks/use-session", () => ({ useSession: () => useSession() }));
vi.mock("~/features/recent-measurements/hooks/use-measurement-upload", () => ({
  useMeasurementUpload: () => useMeasurementUpload(),
}));
vi.mock("~/features/recent-measurements/hooks/use-measurements", () => ({
  useMeasurements: () => useMeasurements(),
}));
vi.mock("~/shared/time/time-sync", () => ({
  getSyncedUtcISO: () => getSyncedUtcISO(),
  getSyncedLocalISO: () => getSyncedLocalISO(),
  getTimeSyncState: () => getTimeSyncState(),
}));
// $device ctx reads the connected-device registry; empty here (no device).
vi.mock("~/features/connection/stores/use-scanner-command-executor-store", () => ({
  useScannerCommandExecutorStore: (
    selector: (s: {
      executors: ReadonlyMap<string, { device: Device; identity: undefined }>;
    }) => unknown,
  ) => selector({ executors: scannerExecutors.current }),
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key === "measurementFlow:analysis.node.defaultExperimentName" ? "Experiment" : key,
  }),
}));

vi.mock("./analysis-summary-card", () => ({
  AnalysisSummaryCard: (props: { experimentName: string }) => {
    summaryProps(props);
    return null;
  },
}));
vi.mock("./analysis-macro-result", () => ({
  AnalysisMacroResult: (props: {
    ctx?: Record<string, unknown>;
    inputError?: Error;
    onProcessed?: (outputs: Record<string, unknown>[]) => void;
  }) => {
    macroResultProps(props);
    return null;
  },
}));
vi.mock("./analysis-action-bar", () => ({
  AnalysisActionBar: (props: { onUpload: () => void }) => {
    actionBarProps(props);
    return null;
  },
  useScrollToTop: () => ({
    scrollViewRef: { current: null },
    hasScrolled: false,
    handleScroll: () => undefined,
    scrollToTop: () => undefined,
  }),
}));
vi.mock("~/shared/ui/measurement/comment-modal", () => ({ CommentModal: () => null }));
vi.mock("~/shared/ui/measurement/measurement-questions-modal", () => ({
  MeasurementQuestionsModal: () => null,
}));

const CONTENT = { params: {}, macroId: "macro-1" } as AnalysisContent;

const resolvedName = () => summaryProps.mock.calls.at(-1)?.[0]?.experimentName as string;

beforeEach(() => {
  useMeasurementFlowStore.setState({
    experimentId: undefined,
    experimentLabel: undefined,
    flowNodes: [],
    currentFlowStep: 0,
    iterationCount: 0,
    scanResult: undefined,
    scanResults: undefined,
    producerCellId: undefined,
    cellOutputs: {},
    cells: [],
  });
  useFlowAnswersStore.setState({
    answersHistory: [{}],
    autoincrementSettings: {},
    rememberAnswerSettings: {},
  });
  summaryProps.mockClear();
  macroResultProps.mockClear();
  actionBarProps.mockClear();
  useExperiments.mockReturnValue({ experiments: [{ value: "exp-1", label: "From Query" }] });
  useSession.mockReturnValue({ session: { data: { user: { id: "user-1" } } } });
  useMeasurementUpload.mockReturnValue({
    isUploading: false,
    uploadMeasurement: vi.fn(),
    uploadMeasurements: vi.fn(),
  });
  useMeasurements.mockReturnValue({ updateMeasurementComment: vi.fn() });
  getSyncedUtcISO.mockReturnValue("2026-04-20T10:00:00.000Z");
  getSyncedLocalISO.mockReturnValue("2026-04-20T12:00:00.000+02:00");
  getTimeSyncState.mockReturnValue({ timezone: "Europe/Amsterdam" });
  scannerExecutors.current = new Map();
});

describe("AnalysisNode experiment name", () => {
  it("prefers the persisted experimentLabel over the live query label", () => {
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      experimentLabel: "Greenhouse Trial B",
    });
    render(<AnalysisNode content={CONTENT} nodeId="m1" />);
    expect(resolvedName()).toBe("Greenhouse Trial B");
  });

  it("keeps the name when the experiments query is empty (offline / cold resume)", () => {
    useExperiments.mockReturnValue({ experiments: [] });
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      experimentLabel: "Wheat Trial 2026",
    });
    render(<AnalysisNode content={CONTENT} nodeId="m1" />);
    expect(resolvedName()).toBe("Wheat Trial 2026");
  });

  it("uses the live query label when no persisted label is present", () => {
    useMeasurementFlowStore.setState({ experimentId: "exp-1", experimentLabel: undefined });
    render(<AnalysisNode content={CONTENT} nodeId="m1" />);
    expect(resolvedName()).toBe("From Query");
  });

  it("falls back to the default when neither label nor query resolves", () => {
    useExperiments.mockReturnValue({ experiments: [] });
    useMeasurementFlowStore.setState({ experimentId: "exp-missing", experimentLabel: undefined });
    render(<AnalysisNode content={CONTENT} nodeId="m1" />);
    expect(resolvedName()).toBe("Experiment");
  });
});

describe("AnalysisNode macro output", () => {
  it("builds legacy single-result device context from the connected executor", () => {
    scannerExecutors.current = new Map([
      [
        "legacy-1",
        {
          device: { type: "bluetooth-classic", id: "legacy-1", name: "Plot probe" },
          identity: undefined,
        },
      ],
    ]);
    useMeasurementFlowStore.setState({ scanResult: { sample: [{ phi2: 0.8 }] } });

    render(<AnalysisNode content={CONTENT} nodeId="m1" />);

    expect(macroResultProps.mock.calls.at(-1)?.[0]?.ctx).toMatchObject({
      $device: {
        family: "multispeq",
        id: "legacy-1",
        name: "Plot probe",
        index: 0,
      },
    });
  });

  it("persists the primary output once and ignores empty or identical callbacks", () => {
    useMeasurementFlowStore.setState({ cellOutputs: {} });
    render(<AnalysisNode content={CONTENT} nodeId="m1" />);
    const onProcessed = macroResultProps.mock.calls.at(-1)?.[0]?.onProcessed as
      | ((outputs: Record<string, unknown>[]) => void)
      | undefined;

    act(() => onProcessed?.([]));
    expect(useMeasurementFlowStore.getState().cellOutputs.m1).toBeUndefined();

    act(() => onProcessed?.([{ chlorophyll: 42 }]));
    expect(useMeasurementFlowStore.getState().cellOutputs.m1).toEqual({ chlorophyll: 42 });

    act(() => onProcessed?.([{ chlorophyll: 42 }]));
    expect(useMeasurementFlowStore.getState().cellOutputs.m1).toEqual({ chlorophyll: 42 });
  });

  it.each([
    ["an empty sample envelope", { sample: [] }],
    ["an empty top-level array", []],
  ])("surfaces %s as a controlled processing failure", (_label, raw) => {
    useMeasurementFlowStore.setState({
      scanResult: raw as never,
      scanResults: [{ result: raw as never }],
      producerCellId: "p1",
      cells: [
        {
          id: "p1",
          type: "protocol",
          isCollapsed: false,
          payload: { protocolId: "proto-1", version: 1, name: "Measurement" },
        },
        {
          id: "m1",
          type: "macro",
          isCollapsed: false,
          payload: { macroId: "macro-1", language: "javascript", name: "Analysis" },
        },
      ],
    });

    expect(() => render(<AnalysisNode content={CONTENT} nodeId="m1" />)).not.toThrow();
    const props = macroResultProps.mock.calls.at(-1)?.[0] as
      | { ctx?: Record<string, unknown>; inputError?: Error }
      | undefined;
    expect(props?.ctx).toEqual({});
    expect(props?.inputError).toMatchObject({
      name: "OutputDataNormalizationError",
      code: "empty-envelope",
    });
  });
});

describe("AnalysisNode upload with a command in the flow", () => {
  const withMacro = {
    params: {},
    macroId: "macro-1",
    macro: { id: "macro-1", name: "Chlorophyll", filename: "chloro.py" },
  } as AnalysisContent;

  // Command → Protocol → Macro: the command rides a "measurement" node with no
  // protocolId. Regression (Vlad, on device): flowProtocolId picked the command
  // node, so the upload threw "Missing protocol id" (swallowed by .catch) and no
  // local measurement was created. It must now resolve the real protocol.
  const commandProtocolMacroNodes = [
    {
      id: "cmd1",
      type: "measurement",
      name: "battery",
      isStart: true,
      content: { command: { format: "string", content: "battery" } },
    },
    {
      id: "p1",
      type: "measurement",
      name: "Proto",
      isStart: false,
      content: { protocolId: "proto-1", protocol: { name: "Proto" } },
    },
    {
      id: "m1",
      type: "analysis",
      name: "Macro",
      isStart: false,
      content: { macroId: "macro-1" },
    },
  ] as unknown as FlowNode[];

  it("uploads the measurement even when a command node precedes the protocol", async () => {
    const uploadMeasurements = vi.fn().mockResolvedValue(undefined);
    useMeasurementUpload.mockReturnValue({ isUploading: false, uploadMeasurements });
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      experimentLabel: "Trial",
      workbookVersionId: "version-1",
      flowNodes: commandProtocolMacroNodes,
      currentFlowStep: 2,
      scanResult: { sample: [{ phi2: 0.8 }] },
    });

    render(<AnalysisNode content={withMacro} nodeId="m1" />);

    const props = actionBarProps.mock.calls.at(-1)?.[0] as
      | { onUpload: () => Promise<void> }
      | undefined;
    await act(async () => {
      await props?.onUpload();
    });

    expect(uploadMeasurements).toHaveBeenCalledTimes(1);
    expect(uploadMeasurements.mock.calls[0][0]).toMatchObject({
      protocolId: "proto-1",
      workbookVersionId: "version-1",
      results: [{ rawMeasurement: { sample: [{ phi2: 0.8 }] } }],
    });
  });

  it("renders per-device results and uploads a linked multi-device round", async () => {
    const uploadMeasurements = vi.fn().mockResolvedValue(undefined);
    useMeasurementUpload.mockReturnValue({ isUploading: false, uploadMeasurements });
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      experimentLabel: "Trial",
      workbookVersionId: "version-1",
      flowNodes: commandProtocolMacroNodes,
      currentFlowStep: 2,
      scanResult: { sample: [{ phi2: 0.8 }] },
      scanResults: [
        { device: { id: "1", name: "MultispeQ #1" }, result: { sample: [{ phi2: 0.8 }] } },
        { device: { id: "2", name: "MultispeQ #2" }, result: { sample: [{ phi2: 0.7 }] } },
      ],
      producerCellId: "p1",
      cells: [
        {
          id: "p1",
          type: "protocol",
          isCollapsed: false,
          payload: { protocolId: "proto-1", version: 1, name: "Measurement" },
        },
        {
          id: "m1",
          type: "macro",
          isCollapsed: false,
          payload: { macroId: "macro-1", language: "python", name: "Analysis" },
        },
      ],
    });

    render(<AnalysisNode content={withMacro} nodeId="m1" />);

    // Per-device headings only show for multi rounds.
    expect(screen.getAllByText(/measurementFlow:analysis.workbookRun.deviceHeading/)).toHaveLength(
      2,
    );
    const contexts = macroResultProps.mock.calls.map(([props]) => props.ctx);
    expect(contexts[0]).toMatchObject({ measurement: { phi2: 0.8 } });
    expect(contexts[1]).toMatchObject({ measurement: { phi2: 0.7 } });

    const props = actionBarProps.mock.calls.at(-1)?.[0] as
      | { onUpload: () => Promise<void> }
      | undefined;
    await act(async () => {
      await props?.onUpload();
    });

    expect(uploadMeasurements).toHaveBeenCalledTimes(1);
    expect(uploadMeasurements.mock.calls[0][0]).toMatchObject({
      workbookVersionId: "version-1",
      results: [
        {
          rawMeasurement: { sample: [{ phi2: 0.8 }] },
          device: { id: "1" },
          macroContext: { measurement: { phi2: 0.8 } },
        },
        {
          rawMeasurement: { sample: [{ phi2: 0.7 }] },
          device: { id: "2" },
          macroContext: { measurement: { phi2: 0.7 } },
        },
      ],
    });
  });

  it("threads each dispatch result's own protocolId/protocolName to the upload", async () => {
    const uploadMeasurements = vi.fn().mockResolvedValue(undefined);
    useMeasurementUpload.mockReturnValue({ isUploading: false, uploadMeasurements });
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      experimentLabel: "Trial",
      flowNodes: commandProtocolMacroNodes,
      currentFlowStep: 2,
      scanResult: { sample: [{ phi2: 0.8 }] },
      scanResults: [
        {
          device: { id: "1", name: "MultispeQ #1" },
          result: { sample: [{ phi2: 0.8 }] },
          protocolId: "proto-1",
          protocolName: "Proto",
        },
        {
          device: { id: "2", name: "Ambit #1" },
          result: { sample: [{ spad: 40 }] },
          protocolId: "proto-2",
          protocolName: "SPAD",
        },
      ],
    });

    render(<AnalysisNode content={withMacro} nodeId="m1" />);

    const props = actionBarProps.mock.calls.at(-1)?.[0] as
      | { onUpload: () => Promise<void> }
      | undefined;
    await act(async () => {
      await props?.onUpload();
    });

    expect(uploadMeasurements.mock.calls[0][0]).toMatchObject({
      results: [
        { device: { id: "1" }, protocolId: "proto-1", protocolName: "Proto" },
        { device: { id: "2" }, protocolId: "proto-2", protocolName: "SPAD" },
      ],
    });
  });
});
