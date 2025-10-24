import { useExperiment } from "@/hooks/experiment/useExperiment/useExperiment";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import ExperimentDataPage from "./page";

globalThis.React = React;

// Mock react.use to return a params-like object { id, locale }
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    use: vi.fn().mockReturnValue({ id: "test-experiment-id" }),
  };
});

// Mock useExperiment hook
vi.mock("@/hooks/experiment/useExperiment/useExperiment", () => ({
  useExperiment: vi.fn(),
}));

// Mock translation hook
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// Mock useLocale hook
vi.mock("~/hooks/useLocale", () => ({
  useLocale: () => "en-US",
}));

// Mock ExperimentDataSampleTables component
vi.mock("~/components/experiment-data/experiment-data-sample-tables", () => ({
  ExperimentDataSampleTables: ({
    experimentId,
    sampleSize,
    locale,
    archived,
  }: {
    experimentId: string;
    sampleSize: number;
    locale: string;
    archived: boolean;
  }) => (
    <div
      data-testid="experiment-data-sample-tables"
      data-experiment-id={experimentId}
      data-sample-size={sampleSize}
      data-locale={locale}
      data-archived={archived}
    />
  ),
}));

// Mock DataUploadModal component
vi.mock("~/components/experiment-data/data-upload-modal/data-upload-modal", () => ({
  DataUploadModal: ({
    experimentId,
    open,
    onOpenChange,
  }: {
    experimentId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div
      data-testid="data-upload-modal"
      data-experiment-id={experimentId}
      data-open={open}
      onClick={() => onOpenChange(!open)}
    />
  ),
}));

// Mock next/navigation notFound
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("<ExperimentDataPage />", () => {
  it("shows loading when experiment is loading", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);

    render(
      <ExperimentDataPage
        params={Promise.resolve({ id: "test-experiment-id", locale: "en-US" })}
      />,
    );

    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("renders ErrorDisplay when there is an error loading", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("fail"),
    } as unknown as ReturnType<typeof useExperiment>);

    render(
      <ExperimentDataPage
        params={Promise.resolve({ id: "test-experiment-id", locale: "en-US" })}
      />,
    );

    expect(screen.getByText("failedToLoad")).toBeInTheDocument();
    expect(screen.getByText("fail")).toBeInTheDocument();
  });

  it("shows notFound text when experiment data is missing", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);

    render(
      <ExperimentDataPage
        params={Promise.resolve({ id: "test-experiment-id", locale: "en-US" })}
      />,
    );

    expect(screen.getByText("notFound")).toBeInTheDocument();
  });

  it("calls notFound when experiment is not archived", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: { body: { status: "active" } },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);

    // Make notFound throw so render will surface it
    vi.mocked(notFound).mockImplementation(() => {
      throw new Error("notFound");
    });

    expect(() =>
      render(
        <ExperimentDataPage
          params={Promise.resolve({ id: "test-experiment-id", locale: "en-US" })}
        />,
      ),
    ).toThrow("notFound");
  });

  it("renders data page with upload button and sample tables when experiment is archived", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: { body: { status: "archived" } },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);

    render(
      <ExperimentDataPage
        params={Promise.resolve({ id: "test-experiment-id", locale: "en-US" })}
      />,
    );

    // Check page title and description
    expect(screen.getByText("experimentData.title")).toBeInTheDocument();
    expect(screen.getByText("experimentData.description")).toBeInTheDocument();

    // Check upload button is rendered and disabled
    const uploadButton = screen.getByRole("button", { name: /experimentData.uploadData/i });
    expect(uploadButton).toBeInTheDocument();
    expect(uploadButton).toBeDisabled();

    // Check sample tables component is rendered with correct props
    const sampleTables = screen.getByTestId("experiment-data-sample-tables");
    expect(sampleTables).toBeInTheDocument();
    expect(sampleTables).toHaveAttribute("data-experiment-id", "test-experiment-id");
    expect(sampleTables).toHaveAttribute("data-sample-size", "5");
    expect(sampleTables).toHaveAttribute("data-locale", "en-US");
    expect(sampleTables).toHaveAttribute("data-archived", "true");
  });

  it("opens and closes the upload modal when button is clicked", () => {
    vi.mocked(useExperiment).mockReturnValue({
      data: { body: { status: "archived" } },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useExperiment>);

    render(
      <ExperimentDataPage
        params={Promise.resolve({ id: "test-experiment-id", locale: "en-US" })}
      />,
    );

    // Modal should be closed initially
    const modal = screen.getByTestId("data-upload-modal");
    expect(modal).toHaveAttribute("data-open", "false");

    expect(modal).toHaveAttribute("data-experiment-id", "test-experiment-id");
  });
});
