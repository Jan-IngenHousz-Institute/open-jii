import { createExperiment, createExperimentAccess, createFlow } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { notFound } from "next/navigation";
import { useEffect, useImperativeHandle, forwardRef, use } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { contract } from "@repo/api";

import ExperimentFlowPage from "./page";

// Mock FlowEditor (keep — complex forwardRef/useImperativeHandle component)
const mockGetFlowData = vi.fn(() => ({ nodes: [{ id: "n1" }] }));

vi.mock("@/components/flow-editor", () => ({
  FlowEditor: forwardRef<
    { getFlowData: () => { nodes: { id: string }[] } },
    {
      initialFlow?: unknown;
      isDisabled?: boolean;
      onDirtyChange?: () => void;
    }
  >((props, ref) => {
    const { onDirtyChange, initialFlow, isDisabled } = props;

    useImperativeHandle(ref, () => ({
      getFlowData: mockGetFlowData,
    }));

    useEffect(() => {
      if (onDirtyChange) {
        onDirtyChange();
      }
    }, [onDirtyChange]);

    return (
      <div data-testid="flow-editor">
        <div data-testid="flow-initial">{initialFlow ? "has-flow" : "no-flow"}</div>
        <div data-testid="flow-disabled">{String(isDisabled)}</div>
      </div>
    );
  }),
}));

/* --------------------------------- Helpers -------------------------------- */

const EXP_ID = "test-experiment-id";
const PARAMS = Promise.resolve({ id: EXP_ID, locale: "en-US" });

const archivedExperiment = createExperiment({ id: EXP_ID, status: "archived" });
const activeExperiment = createExperiment({ id: EXP_ID, status: "active" });

const accessPayload = createExperimentAccess({
  experiment: { id: EXP_ID, status: "archived" },
  isAdmin: false,
});

/** Mount all three query endpoints with sensible archived defaults. */
function mountDefaults() {
  server.mount(contract.experiments.getExperiment, { body: archivedExperiment });
  server.mount(contract.experiments.getExperimentAccess, { body: accessPayload });
  server.mount(contract.experiments.getFlow, { status: 404 });
}

/* ---------------------------------- Tests --------------------------------- */

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(use).mockReturnValue({ id: EXP_ID });
  mockGetFlowData.mockReturnValue({ nodes: [{ id: "n1" }] });

  vi.spyOn(console, "error").mockImplementation(() => {
    /* no-op */
  });
});

describe("<ExperimentFlowPage />", () => {
  it("shows loading when experiment or access is loading", () => {
    server.mount(contract.experiments.getExperiment, { delay: "infinite" });
    server.mount(contract.experiments.getExperimentAccess, { delay: "infinite" });
    server.mount(contract.experiments.getFlow, { status: 404 });

    render(<ExperimentFlowPage params={PARAMS} />);

    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("renders ErrorDisplay when there is an error loading", async () => {
    server.mount(contract.experiments.getExperiment, { status: 500 });
    server.mount(contract.experiments.getExperimentAccess, { body: accessPayload });
    server.mount(contract.experiments.getFlow, { status: 404 });

    render(<ExperimentFlowPage params={PARAMS} />);

    await waitFor(() => {
      expect(screen.getByText("failedToLoad")).toBeInTheDocument();
    });
  });

  it("shows notFound text when experiment data or access experiment is missing", async () => {
    // Experiment loads fine, but access returns with no experiment → triggers notFound text
    server.mount(contract.experiments.getExperiment, { body: archivedExperiment });
    server.mount(contract.experiments.getExperimentAccess, {
      body: { experiment: null, hasAccess: false, isAdmin: false },
    });
    server.mount(contract.experiments.getFlow, { status: 404 });

    render(<ExperimentFlowPage params={PARAMS} />);

    await waitFor(() => {
      expect(screen.getByText("notFound")).toBeInTheDocument();
    });
  });

  it("calls notFound when experiment is not archived", async () => {
    server.mount(contract.experiments.getExperiment, { body: activeExperiment });
    server.mount(contract.experiments.getExperimentAccess, {
      body: createExperimentAccess({
        experiment: { id: EXP_ID, status: "active" },
      }),
    });
    server.mount(contract.experiments.getFlow, { status: 404 });

    render(<ExperimentFlowPage params={PARAMS} />);

    await waitFor(() => {
      expect(vi.mocked(notFound)).toHaveBeenCalled();
    });
  });
});
