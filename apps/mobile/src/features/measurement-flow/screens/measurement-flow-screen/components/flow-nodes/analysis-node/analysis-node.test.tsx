import { render } from "@testing-library/react-native";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import type { AnalysisContent } from "~/shared/measurements/flow-node";

import { AnalysisNode } from "./analysis-node";

// Mock only the network/native edges and the heavy child components. The node
// itself runs unmocked so its experiment-name resolution executes for real;
// summaryProps captures the name the node hands to the summary card.
const {
  summaryProps,
  useExperiments,
  useSession,
  useMeasurementUpload,
  useMeasurements,
  getSyncedUtcISO,
  getSyncedLocalISO,
  getTimeSyncState,
} = vi.hoisted(() => ({
  summaryProps: vi.fn(),
  useExperiments: vi.fn(),
  useSession: vi.fn(),
  useMeasurementUpload: vi.fn(),
  useMeasurements: vi.fn(),
  getSyncedUtcISO: vi.fn(),
  getSyncedLocalISO: vi.fn(),
  getTimeSyncState: vi.fn(),
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
vi.mock("./analysis-macro-result", () => ({ AnalysisMacroResult: () => null }));
vi.mock("./analysis-action-bar", () => ({
  AnalysisActionBar: () => null,
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
  });
  useFlowAnswersStore.setState({
    answersHistory: [{}],
    autoincrementSettings: {},
    rememberAnswerSettings: {},
  });
  summaryProps.mockClear();
  useExperiments.mockReturnValue({ experiments: [{ value: "exp-1", label: "From Query" }] });
  useSession.mockReturnValue({ session: { data: { user: { id: "user-1" } } } });
  useMeasurementUpload.mockReturnValue({ isUploading: false, uploadMeasurement: vi.fn() });
  useMeasurements.mockReturnValue({ updateMeasurementComment: vi.fn() });
  getSyncedUtcISO.mockReturnValue("2026-04-20T10:00:00.000Z");
  getSyncedLocalISO.mockReturnValue("2026-04-20T12:00:00.000+02:00");
  getTimeSyncState.mockReturnValue({ timezone: "Europe/Amsterdam" });
});

describe("AnalysisNode experiment name", () => {
  it("prefers the persisted experimentLabel over the live query label", () => {
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      experimentLabel: "Greenhouse Trial B",
    });
    render(<AnalysisNode content={CONTENT} />);
    expect(resolvedName()).toBe("Greenhouse Trial B");
  });

  it("keeps the name when the experiments query is empty (offline / cold resume)", () => {
    useExperiments.mockReturnValue({ experiments: [] });
    useMeasurementFlowStore.setState({
      experimentId: "exp-1",
      experimentLabel: "Wheat Trial 2026",
    });
    render(<AnalysisNode content={CONTENT} />);
    expect(resolvedName()).toBe("Wheat Trial 2026");
  });

  it("uses the live query label when no persisted label is present", () => {
    useMeasurementFlowStore.setState({ experimentId: "exp-1", experimentLabel: undefined });
    render(<AnalysisNode content={CONTENT} />);
    expect(resolvedName()).toBe("From Query");
  });

  it("falls back to the default when neither label nor query resolves", () => {
    useExperiments.mockReturnValue({ experiments: [] });
    useMeasurementFlowStore.setState({ experimentId: "exp-missing", experimentLabel: undefined });
    render(<AnalysisNode content={CONTENT} />);
    expect(resolvedName()).toBe("Experiment");
  });
});
