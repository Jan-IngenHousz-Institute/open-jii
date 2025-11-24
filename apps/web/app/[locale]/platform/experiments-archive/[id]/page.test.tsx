import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useExperimentLocations } from "@/hooks/experiment/useExperimentLocations/useExperimentLocations";
import { useExperimentMembers } from "@/hooks/experiment/useExperimentMembers/useExperimentMembers";
import { useExperimentVisualizations } from "@/hooks/experiment/useExperimentVisualizations/useExperimentVisualizations";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import ExperimentOverviewPage from "./page";

globalThis.React = React;

// Mock react.use to return a params-like object { id }
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    use: vi.fn().mockReturnValue({ id: "test-experiment-id" }),
  };
});

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

// Mock translation hook
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
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

// Mock next/navigation notFound
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

// Helper to render with QueryClient
const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

beforeEach(() => {
  vi.clearAllMocks();

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

    renderWithQueryClient(
      <ExperimentOverviewPage params={Promise.resolve({ id: "test-experiment-id" })} />,
    );

    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("renders ErrorDisplay when there is an error loading", () => {
    vi.mocked(useExperimentAccess).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("fail"),
    } as ReturnType<typeof useExperimentAccess>);

    renderWithQueryClient(
      <ExperimentOverviewPage params={Promise.resolve({ id: "test-experiment-id" })} />,
    );

    expect(screen.getByTestId("error-title")).toHaveTextContent("failedToLoad");
    expect(screen.getByTestId("error-message")).toHaveTextContent("fail");
  });

  it("shows notFound text when experiment data is missing", () => {
    vi.mocked(useExperimentAccess).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useExperimentAccess>);

    renderWithQueryClient(
      <ExperimentOverviewPage params={Promise.resolve({ id: "test-experiment-id" })} />,
    );

    expect(screen.getByText("notFound")).toBeInTheDocument();
  });

  it("shows notFound text when experiment is missing from body", () => {
    vi.mocked(useExperimentAccess).mockReturnValue({
      data: { body: { experiment: undefined, hasAccess: false } },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperimentAccess>);

    renderWithQueryClient(
      <ExperimentOverviewPage params={Promise.resolve({ id: "test-experiment-id" })} />,
    );

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
      renderWithQueryClient(
        <ExperimentOverviewPage params={Promise.resolve({ id: "test-experiment-id" })} />,
      ),
    ).toThrow("notFound");
  });
});
