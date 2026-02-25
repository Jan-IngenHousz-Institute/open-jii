import { createExperimentAccess } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";

import ExperimentOverviewPage from "./page";

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal()),
  use: () => ({ id: "test-id" }),
}));

vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ title }: { title: string }) => <div role="alert">{title}</div>,
}));
vi.mock("~/components/experiment-overview/experiment-description", () => ({
  ExperimentDescription: () => <section aria-label="description" />,
}));
vi.mock("~/components/experiment-overview/experiment-details/experiment-details-card", () => ({
  ExperimentDetailsCard: () => <section aria-label="details" />,
}));
vi.mock(
  "~/components/experiment-overview/experiment-linked-protocols/experiment-linked-protocols",
  () => ({
    ExperimentLinkedProtocols: () => <section aria-label="protocols" />,
  }),
);
vi.mock("~/components/experiment-overview/experiment-measurements", () => ({
  ExperimentMeasurements: () => <section aria-label="measurements" />,
}));
vi.mock("@/components/experiment-visualizations/experiment-visualizations-display", () => ({
  default: () => <section aria-label="visualizations" />,
}));

const accessPayload = createExperimentAccess({
  isAdmin: true,
  experiment: { id: "test-id", name: "T", description: "d", status: "active" },
});

function mountDefaults() {
  server.mount(contract.experiments.getExperimentAccess, { body: accessPayload });
  server.mount(contract.experiments.getExperimentLocations, { body: [] });
  server.mount(contract.experiments.listExperimentMembers, { body: [] });
  server.mount(contract.experiments.listExperimentVisualizations, { body: [] });
}

describe("ExperimentOverviewPage", () => {
  beforeEach(() => vi.clearAllMocks());

  const props = { params: Promise.resolve({ id: "test-id" }) };

  it("shows loading state", () => {
    mountDefaults();
    render(<ExperimentOverviewPage {...props} />);
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("shows error display on failure", async () => {
    server.mount(contract.experiments.getExperimentAccess, { status: 500 });
    server.mount(contract.experiments.getExperimentLocations, { body: [] });
    server.mount(contract.experiments.listExperimentMembers, { body: [] });
    server.mount(contract.experiments.listExperimentVisualizations, { body: [] });
    render(<ExperimentOverviewPage {...props} />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("failedToLoad");
    });
  });

  it("renders experiment sections on success", async () => {
    mountDefaults();
    render(<ExperimentOverviewPage {...props} />);
    await waitFor(() => {
      expect(screen.getByRole("region", { name: /details/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("region", { name: /description/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /protocols/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /measurements/i })).toBeInTheDocument();
  });
});
