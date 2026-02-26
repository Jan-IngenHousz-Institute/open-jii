import { createExperiment, createExperimentAccess, createFlow } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { notFound } from "next/navigation";
import { use } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";

import ExperimentFlowPage from "./page";

// --- Mocks (component-level only, no hook mocks) ---

vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ error, title }: { error: unknown; title: string }) => (
    <div data-testid="error-display">
      {title}: {String(error)}
    </div>
  ),
}));

vi.mock("@/components/flow-editor", () => ({
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

// --- Helpers ---

const EXP_ID = "exp-123";
const LOCALE = "en-US";
const defaultProps = {
  params: Promise.resolve({ locale: LOCALE, id: EXP_ID }),
};

const activeExperiment = createExperiment({
  id: EXP_ID,
  status: "active",
  name: "Test Experiment",
});

const accessPayload = createExperimentAccess({
  experiment: { id: EXP_ID, name: "Test Experiment", status: "active" },
  isAdmin: true,
});

/** Mount all five endpoints with sensible active-experiment defaults. */
function mountDefaults() {
  server.mount(contract.experiments.getExperiment, { body: activeExperiment });
  server.mount(contract.experiments.getExperimentAccess, { body: accessPayload });
  server.mount(contract.experiments.getFlow, { status: 404 }); // no flow yet
  server.mount(contract.experiments.createFlow, { body: createFlow({ experimentId: EXP_ID }) });
  server.mount(contract.experiments.updateFlow, { body: createFlow({ experimentId: EXP_ID }) });
}

// --- Tests ---
describe("ExperimentFlowPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(use).mockReturnValue({ id: EXP_ID, locale: LOCALE });
  });

  it("renders the experiment flow page with all components when loaded", async () => {
    mountDefaults();
    render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByText("flow.title")).toBeInTheDocument();
      expect(screen.getByTestId("flow-editor")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /flow.saveFlow/ })).toBeInTheDocument();
    });
  });

  it("displays loading state when experiment is loading", () => {
    server.mount(contract.experiments.getExperiment, { delay: "infinite" });
    server.mount(contract.experiments.getExperimentAccess, { body: accessPayload });
    server.mount(contract.experiments.getFlow, { status: 404 });
    server.mount(contract.experiments.createFlow, { body: createFlow({ experimentId: EXP_ID }) });
    server.mount(contract.experiments.updateFlow, { body: createFlow({ experimentId: EXP_ID }) });

    render(<ExperimentFlowPage params={defaultProps.params} />);

    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("displays error state when experiment fails to load", async () => {
    server.mount(contract.experiments.getExperiment, { status: 500 });
    server.mount(contract.experiments.getExperimentAccess, { body: accessPayload });
    server.mount(contract.experiments.getFlow, { status: 404 });
    server.mount(contract.experiments.createFlow, { body: createFlow({ experimentId: EXP_ID }) });
    server.mount(contract.experiments.updateFlow, { body: createFlow({ experimentId: EXP_ID }) });

    render(<ExperimentFlowPage params={defaultProps.params} />);

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
    server.mount(contract.experiments.getFlow, { status: 404 });
    server.mount(contract.experiments.createFlow, { body: createFlow({ experimentId: EXP_ID }) });
    server.mount(contract.experiments.updateFlow, { body: createFlow({ experimentId: EXP_ID }) });

    render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(vi.mocked(notFound)).toHaveBeenCalled();
    });
  });

  it("renders FlowEditor with correct props", async () => {
    mountDefaults();
    render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      const flowEditor = screen.getByTestId("flow-editor");
      expect(flowEditor).toHaveAttribute("data-disabled", "false");
      expect(flowEditor).toHaveAttribute("data-initial-flow", "null");
    });
  });

  it("displays access loading state", () => {
    server.mount(contract.experiments.getExperiment, { body: activeExperiment });
    server.mount(contract.experiments.getExperimentAccess, { delay: "infinite" });
    server.mount(contract.experiments.getFlow, { status: 404 });
    server.mount(contract.experiments.createFlow, { body: createFlow({ experimentId: EXP_ID }) });
    server.mount(contract.experiments.updateFlow, { body: createFlow({ experimentId: EXP_ID }) });

    render(<ExperimentFlowPage params={defaultProps.params} />);

    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("displays access error state", async () => {
    server.mount(contract.experiments.getExperiment, { body: activeExperiment });
    server.mount(contract.experiments.getExperimentAccess, { status: 500 });
    server.mount(contract.experiments.getFlow, { status: 404 });
    server.mount(contract.experiments.createFlow, { body: createFlow({ experimentId: EXP_ID }) });
    server.mount(contract.experiments.updateFlow, { body: createFlow({ experimentId: EXP_ID }) });

    render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByTestId("error-display")).toBeInTheDocument();
    });
  });

  it("renders save button", async () => {
    mountDefaults();
    render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /flow.saveFlow/ })).toBeInTheDocument();
    });
  });
});
