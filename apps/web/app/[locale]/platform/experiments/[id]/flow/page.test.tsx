import {
  createExperiment,
  createExperimentAccess,
  createProtocolCell,
  createWorkbook,
  createWorkbookVersionSummary,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { notFound } from "next/navigation";
import { use } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";

import ExperimentFlowPage from "./page";

vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ error, title }: { error: unknown; title: string }) => (
    <div data-testid="error-display">
      {title}: {String(error)}
    </div>
  ),
}));

vi.mock("@/components/flow-editor/flow-editor", () => ({
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

vi.mock("@/components/workbook/workbook-editor", () => ({
  WorkbookEditor: ({ cells, readOnly }: { cells: unknown[]; readOnly?: boolean }) => (
    <div data-testid="workbook-editor" data-readonly={readOnly ? "true" : "false"}>
      Workbook Editor ({cells.length} cells)
    </div>
  ),
}));

const EXP_ID = "exp-123";
const WB_ID = "wb-1";
const VERSION_ID = "ver-1";
const LOCALE = "en-US";
const defaultProps = {
  params: Promise.resolve({ locale: LOCALE, id: EXP_ID }),
};

const activeExperiment = createExperiment({
  id: EXP_ID,
  status: "active",
  name: "Test Experiment",
});

const experimentWithWorkbook = createExperiment({
  id: EXP_ID,
  status: "active",
  name: "Test Experiment",
  workbookId: WB_ID,
  workbookVersionId: VERSION_ID,
});

const accessPayload = createExperimentAccess({
  experiment: { id: EXP_ID, name: "Test Experiment", status: "active" },
  isAdmin: true,
});

const readOnlyAccessPayload = createExperimentAccess({
  experiment: { id: EXP_ID, name: "Test Experiment", status: "active" },
  isAdmin: false,
});

const versionSummary = createWorkbookVersionSummary({
  id: VERSION_ID,
  workbookId: WB_ID,
  version: 1,
});

const newerVersionSummary = createWorkbookVersionSummary({
  id: "ver-2",
  workbookId: WB_ID,
  version: 2,
});

function mountDefaults() {
  server.mount(contract.experiments.getExperiment, { body: activeExperiment });
  server.mount(contract.experiments.getExperimentAccess, { body: accessPayload });
  server.mount(contract.workbooks.listWorkbooks, { body: [] });
}

function mountWithWorkbook(overrides?: {
  versions?: (typeof versionSummary)[];
  isAdmin?: boolean;
}) {
  server.mount(contract.experiments.getExperiment, { body: experimentWithWorkbook });
  server.mount(contract.experiments.getExperimentAccess, {
    body: overrides?.isAdmin === false ? readOnlyAccessPayload : accessPayload,
  });
  server.mount(contract.workbooks.getWorkbook, {
    body: createWorkbook({
      id: WB_ID,
      name: "Test Workbook",
      cells: [
        createProtocolCell({ id: "c1", payload: { protocolId: "p1", version: 1, name: "P1" } }),
      ],
    }),
  });
  server.mount(contract.workbooks.listWorkbooks, { body: [] });
  server.mount(contract.workbooks.listWorkbookVersions, {
    body: overrides?.versions ?? [versionSummary],
  });
  server.mount(contract.workbooks.getWorkbookVersion, {
    body: {
      ...versionSummary,
      cells: [
        createProtocolCell({ id: "c1", payload: { protocolId: "p1", version: 1, name: "P1" } }),
      ],
      metadata: {},
    },
  });
}

describe("ExperimentFlowPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(use).mockReturnValue({ id: EXP_ID, locale: LOCALE });
  });

  it("renders the experiment flow page with title when loaded", async () => {
    mountDefaults();
    render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByText("flow.title")).toBeInTheDocument();
    });
  });

  it("displays loading skeleton when experiment is loading", () => {
    server.mount(contract.experiments.getExperiment, { delay: "infinite" });
    server.mount(contract.experiments.getExperimentAccess, { body: accessPayload });
    server.mount(contract.workbooks.listWorkbooks, { body: [] });

    const { container } = render(<ExperimentFlowPage params={defaultProps.params} />);

    // Skeleton elements are rendered during loading
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("displays error state when experiment fails to load", async () => {
    server.mount(contract.experiments.getExperiment, { status: 500 });
    server.mount(contract.experiments.getExperimentAccess, { body: accessPayload });
    server.mount(contract.workbooks.listWorkbooks, { body: [] });

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
    server.mount(contract.workbooks.listWorkbooks, { body: [] });

    render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(vi.mocked(notFound)).toHaveBeenCalled();
    });
  });

  it("renders WorkbookEditor when workbook is linked", async () => {
    mountWithWorkbook();
    render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByTestId("workbook-editor")).toBeInTheDocument();
    });
  });

  it("shows version badge when workbook is linked", async () => {
    mountWithWorkbook();
    render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByText("v1")).toBeInTheDocument();
    });
  });

  it("shows detach and change buttons for admin users", async () => {
    mountWithWorkbook();
    render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByText("flow.detach")).toBeInTheDocument();
      expect(screen.getByText("flow.changeWorkbook")).toBeInTheDocument();
    });
  });

  it("hides detach and change buttons for non-admin users", async () => {
    mountWithWorkbook({ isAdmin: false });
    render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByTestId("workbook-editor")).toBeInTheDocument();
    });
    expect(screen.queryByText("flow.detach")).not.toBeInTheDocument();
    expect(screen.queryByText("flow.changeWorkbook")).not.toBeInTheDocument();
  });

  it("shows upgrade banner when a newer version is available", async () => {
    mountWithWorkbook({ versions: [newerVersionSummary, versionSummary] });
    render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByText(/v2 is available/)).toBeInTheDocument();
      expect(screen.getByText(/flow\.upgradeToLatest/)).toBeInTheDocument();
    });
  });

  it("does not show upgrade banner when already on latest version", async () => {
    mountWithWorkbook({ versions: [versionSummary] });
    render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByTestId("workbook-editor")).toBeInTheDocument();
    });
    expect(screen.queryByText(/is available/)).not.toBeInTheDocument();
  });

  it("shows no-workbook-linked state when no workbook attached", async () => {
    mountDefaults();
    render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByText("flow.noWorkbookLinked")).toBeInTheDocument();
    });
  });

  it("displays access loading skeleton", () => {
    server.mount(contract.experiments.getExperiment, { body: activeExperiment });
    server.mount(contract.experiments.getExperimentAccess, { delay: "infinite" });
    server.mount(contract.workbooks.listWorkbooks, { body: [] });

    const { container } = render(<ExperimentFlowPage params={defaultProps.params} />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("displays access error state", async () => {
    server.mount(contract.experiments.getExperiment, { body: activeExperiment });
    server.mount(contract.experiments.getExperimentAccess, { status: 500 });
    server.mount(contract.workbooks.listWorkbooks, { body: [] });

    render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      expect(screen.getByTestId("error-display")).toBeInTheDocument();
    });
  });

  it("renders WorkbookEditor with readOnly prop", async () => {
    mountWithWorkbook();
    render(<ExperimentFlowPage params={defaultProps.params} />);

    await waitFor(() => {
      const editor = screen.getByTestId("workbook-editor");
      expect(editor).toBeInTheDocument();
      expect(editor).toHaveAttribute("data-readonly", "true");
    });
  });
});
