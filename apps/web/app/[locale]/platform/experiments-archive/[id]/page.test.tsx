import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useExperimentLocations } from "@/hooks/experiment/useExperimentLocations/useExperimentLocations";
import { useExperimentMembers } from "@/hooks/experiment/useExperimentMembers/useExperimentMembers";
import { useExperimentVisualizations } from "@/hooks/experiment/useExperimentVisualizations/useExperimentVisualizations";
import { render, screen } from "@/test/test-utils";
import { notFound } from "next/navigation";
import { use } from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import ExperimentOverviewPage from "./page";

// Mock hooks used by the page
vi.mock("@/hooks/experiment/useExperimentAccess/useExperimentAccess", () => ({
  useExperimentAccess: vi.fn(),
}));

vi.mock("@/hooks/experiment/useExperimentLocations/useExperimentLocations", () => ({
  useExperimentLocations: vi.fn(),
}));

vi.mock("@/hooks/experiment/useExperimentMembers/useExperimentMembers", () => ({
  useExperimentMembers: vi.fn(),
}));

vi.mock("@/hooks/experiment/useExperimentVisualizations/useExperimentVisualizations", () => ({
  useExperimentVisualizations: vi.fn(),
}));

// Mock ErrorDisplay
vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ error, title }: { error: Error; title: string }) => (
    <div data-testid="error-display">
      <div data-testid="error-title">{title}</div>
      <div data-testid="error-message">{error.message}</div>
    </div>
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(use).mockReturnValue({ id: "test-experiment-id" });

  // Default safe returns
  vi.mocked(useExperimentLocations).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as ReturnType<typeof useExperimentLocations>);
  vi.mocked(useExperimentMembers).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useExperimentMembers>);
  vi.mocked(useExperimentVisualizations).mockReturnValue({
    data: undefined,
    isLoading: false,
  } as ReturnType<typeof useExperimentVisualizations>);
});

describe("<ExperimentOverviewPage />", () => {
  it("shows loading when experiment is loading", () => {
    vi.mocked(useExperimentAccess).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useExperimentAccess>);

    render(<ExperimentOverviewPage params={Promise.resolve({ id: "test-experiment-id" })} />);

    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("renders ErrorDisplay when there is an error loading", () => {
    vi.mocked(useExperimentAccess).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("fail"),
    } as ReturnType<typeof useExperimentAccess>);

    render(<ExperimentOverviewPage params={Promise.resolve({ id: "test-experiment-id" })} />);

    expect(screen.getByTestId("error-title")).toHaveTextContent("failedToLoad");
    expect(screen.getByTestId("error-message")).toHaveTextContent("fail");
  });

  it("shows notFound text when experiment data is missing", () => {
    vi.mocked(useExperimentAccess).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useExperimentAccess>);

    render(<ExperimentOverviewPage params={Promise.resolve({ id: "test-experiment-id" })} />);

    expect(screen.getByText("notFound")).toBeInTheDocument();
  });

  it("shows notFound text when experiment is missing from body", () => {
    vi.mocked(useExperimentAccess).mockReturnValue({
      data: { body: { experiment: undefined, hasAccess: false } },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperimentAccess>);

    render(<ExperimentOverviewPage params={Promise.resolve({ id: "test-experiment-id" })} />);

    expect(screen.getByText("notFound")).toBeInTheDocument();
  });

  it("calls notFound when experiment is not archived", () => {
    vi.mocked(useExperimentAccess).mockReturnValue({
      data: {
        body: {
          experiment: { status: "active", name: "Test", id: "123" },
          hasAccess: true,
        },
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useExperimentAccess>);

    vi.mocked(notFound).mockImplementation(() => {
      throw new Error("notFound");
    });

    expect(() =>
      render(<ExperimentOverviewPage params={Promise.resolve({ id: "test-experiment-id" })} />),
    ).toThrow("notFound");
  });
});
