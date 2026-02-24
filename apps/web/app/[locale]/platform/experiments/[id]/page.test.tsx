import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import ExperimentOverviewPage from "./page";

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal()),
  use: () => ({ id: "test-id" }),
}));

const mockAccess = vi.fn();
vi.mock("@/hooks/experiment/useExperimentAccess/useExperimentAccess", () => ({
  useExperimentAccess: mockAccess,
}));
vi.mock("@/hooks/experiment/useExperimentLocations/useExperimentLocations", () => ({
  useExperimentLocations: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("@/hooks/experiment/useExperimentMembers/useExperimentMembers", () => ({
  useExperimentMembers: () => ({ data: undefined, isLoading: false, isError: false }),
}));
vi.mock("@/hooks/experiment/useExperimentVisualizations/useExperimentVisualizations", () => ({
  useExperimentVisualizations: () => ({ data: undefined, isLoading: false }),
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

describe("ExperimentOverviewPage", () => {
  beforeEach(() => vi.clearAllMocks());

  const props = { params: Promise.resolve({ id: "test-id" }) };

  it("shows loading state", () => {
    mockAccess.mockReturnValue({ data: undefined, isLoading: true, error: null });
    render(<ExperimentOverviewPage {...props} />);
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("shows error display on failure", () => {
    mockAccess.mockReturnValue({ data: undefined, isLoading: false, error: new Error("fail") });
    render(<ExperimentOverviewPage {...props} />);
    expect(screen.getByRole("alert")).toHaveTextContent("failedToLoad");
  });

  it("shows not-found when data is missing", () => {
    mockAccess.mockReturnValue({ data: undefined, isLoading: false, error: null });
    render(<ExperimentOverviewPage {...props} />);
    expect(screen.getByText("notFound")).toBeInTheDocument();
  });

  it("renders experiment sections on success", () => {
    mockAccess.mockReturnValue({
      data: {
        body: {
          experiment: { status: "active", name: "T", id: "1", description: "d" },
          isAdmin: true,
        },
      },
      isLoading: false,
      error: null,
    });
    render(<ExperimentOverviewPage {...props} />);
    expect(screen.getByRole("region", { name: /details/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /description/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /protocols/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /measurements/i })).toBeInTheDocument();
  });
});
