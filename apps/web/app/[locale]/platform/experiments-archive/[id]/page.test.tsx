import { createExperimentAccess } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { notFound } from "next/navigation";
import { use } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { contract } from "@repo/api";

import ExperimentOverviewPage from "./page";

vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ error, title }: { error: Error; title: string }) => (
    <div data-testid="error-display">
      <div data-testid="error-title">{title}</div>
      <div data-testid="error-message">{error.message}</div>
    </div>
  ),
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

const archivedAccess = createExperimentAccess({
  experiment: { id: "test-experiment-id", name: "Test", status: "archived" },
});

function mountDefaults(accessOverride?: Parameters<typeof server.mount>[1]) {
  server.mount(
    contract.experiments.getExperimentAccess,
    accessOverride ?? { body: archivedAccess },
  );
  server.mount(contract.experiments.getExperimentLocations, { body: [] });
  server.mount(contract.experiments.listExperimentMembers, { body: [] });
  server.mount(contract.experiments.listExperimentVisualizations, { body: [] });
}

const props = { params: Promise.resolve({ id: "test-experiment-id" }) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(use).mockReturnValue({ id: "test-experiment-id" });
});

describe("<ExperimentOverviewPage />", () => {
  it("shows loading when experiment is loading", () => {
    mountDefaults({ body: archivedAccess, delay: 999_999 });
    render(<ExperimentOverviewPage {...props} />);

    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("renders ErrorDisplay when there is an error loading", async () => {
    server.mount(contract.experiments.getExperimentAccess, { status: 500 });
    server.mount(contract.experiments.getExperimentLocations, { body: [] });
    server.mount(contract.experiments.listExperimentMembers, { body: [] });
    server.mount(contract.experiments.listExperimentVisualizations, { body: [] });

    render(<ExperimentOverviewPage {...props} />);

    await waitFor(() => {
      expect(screen.getByTestId("error-title")).toHaveTextContent("failedToLoad");
    });
  });

  it("shows notFound text when experiment data is missing", async () => {
    server.mount(contract.experiments.getExperimentAccess, {
      body: { experiment: null, hasAccess: false, isAdmin: false },
    });
    server.mount(contract.experiments.getExperimentLocations, { body: [] });
    server.mount(contract.experiments.listExperimentMembers, { body: [] });
    server.mount(contract.experiments.listExperimentVisualizations, { body: [] });

    render(<ExperimentOverviewPage {...props} />);

    await waitFor(() => {
      expect(screen.getByText("notFound")).toBeInTheDocument();
    });
  });

  it("shows notFound text when experiment is missing from body", async () => {
    server.mount(contract.experiments.getExperimentAccess, {
      body: { experiment: undefined, hasAccess: false, isAdmin: false },
    });
    server.mount(contract.experiments.getExperimentLocations, { body: [] });
    server.mount(contract.experiments.listExperimentMembers, { body: [] });
    server.mount(contract.experiments.listExperimentVisualizations, { body: [] });

    render(<ExperimentOverviewPage {...props} />);

    await waitFor(() => {
      expect(screen.getByText("notFound")).toBeInTheDocument();
    });
  });

  it("calls notFound when experiment is not archived", async () => {
    server.mount(contract.experiments.getExperimentAccess, {
      body: createExperimentAccess({
        experiment: { status: "active", name: "Test", id: "123" },
        hasAccess: true,
      }),
    });
    server.mount(contract.experiments.getExperimentLocations, { body: [] });
    server.mount(contract.experiments.listExperimentMembers, { body: [] });
    server.mount(contract.experiments.listExperimentVisualizations, { body: [] });

    render(<ExperimentOverviewPage {...props} />);

    await waitFor(() => {
      expect(vi.mocked(notFound)).toHaveBeenCalled();
    });
  });
});
