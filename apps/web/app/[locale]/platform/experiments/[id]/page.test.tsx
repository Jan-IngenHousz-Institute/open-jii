import { createExperimentAccess } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { use } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import ExperimentOverviewPage from "./page";

vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ title }: { title: string }) => <div role="alert">{title}</div>,
}));
vi.mock("~/components/experiment-overview/experiment-description", () => ({
  ExperimentDescription: () => <section aria-label="description" />,
}));
vi.mock("~/components/experiment-overview/experiment-details/experiment-details-card", () => ({
  ExperimentDetailsCard: () => <section aria-label="details" />,
}));
vi.mock("~/components/experiment-overview/experiment-measurements", () => ({
  ExperimentMeasurements: () => <section aria-label="measurements" />,
}));
vi.mock("@/components/experiment-dashboards/experiment-dashboards-display", () => ({
  default: () => <section aria-label="dashboards" />,
}));
vi.mock("~/components/experiment-overview/experiment-linked-workbook", () => ({
  ExperimentLinkedWorkbook: () => <section aria-label="workbook" />,
}));

const accessPayload = createExperimentAccess({
  isAdmin: true,
  experiment: { id: "test-id", name: "T", description: "d", status: "active" },
});

function mountDefaults() {
  server.mount(orpcContract.experiments.getExperimentAccess, { body: accessPayload });
  server.mount(orpcContract.experiments.getExperimentLocations, { body: [] });
  server.mount(orpcContract.experiments.listExperimentMembers, { body: [] });
  server.mount(orpcContract.experiments.listExperimentDashboards, { body: [] });
}

describe("ExperimentOverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(use).mockReturnValue({ id: "test-id" });
  });

  const props = { params: Promise.resolve({ id: "test-id" }) };

  it("shows loading state", () => {
    mountDefaults();
    render(<ExperimentOverviewPage {...props} />);
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("shows error display on failure", async () => {
    server.mount(orpcContract.experiments.getExperimentAccess, { status: 500 });
    server.mount(orpcContract.experiments.getExperimentLocations, { body: [] });
    server.mount(orpcContract.experiments.listExperimentMembers, { body: [] });
    server.mount(orpcContract.experiments.listExperimentDashboards, { body: [] });
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
    expect(screen.getByRole("region", { name: /workbook/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /measurements/i })).toBeInTheDocument();
  });
});
