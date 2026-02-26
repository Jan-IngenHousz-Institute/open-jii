import { useLocale } from "@/hooks/useLocale";
import { render, screen } from "@/test/test-utils";
import { usePathname, useParams } from "next/navigation";
import { vi, describe, it, expect, beforeEach } from "vitest";

import AnalysisLayout from "./layout";

beforeEach(() => {
  vi.mocked(useLocale).mockReturnValue("en-US");
  vi.mocked(useParams).mockReturnValue({ id: "test-experiment-id" });
});

describe("<AnalysisLayout />", () => {
  it("renders children without layout for sub-pages", () => {
    vi.mocked(usePathname).mockReturnValue(
      "/en-US/platform/experiments-archive/test-id/analysis/visualizations/viz-1",
    );

    render(
      <AnalysisLayout>
        <div>Child Content</div>
      </AnalysisLayout>,
    );

    expect(screen.getByText("Child Content")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("renders full layout for main visualizations page", () => {
    vi.mocked(usePathname).mockReturnValue(
      "/en-US/platform/experiments-archive/test-experiment-id/analysis/visualizations",
    );

    render(
      <AnalysisLayout>
        <div>Child Content</div>
      </AnalysisLayout>,
    );

    expect(screen.getByText("analysis.title")).toBeInTheDocument();
    expect(screen.getByText("analysis.description")).toBeInTheDocument();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });

  it("renders correct tab links for archive experiments", () => {
    vi.mocked(usePathname).mockReturnValue(
      "/en-US/platform/experiments-archive/test-experiment-id/analysis/visualizations",
    );

    render(
      <AnalysisLayout>
        <div>Child Content</div>
      </AnalysisLayout>,
    );

    expect(screen.getByRole("tab", { name: /analysis.visualizations/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /analysis.notebooks/ })).toBeInTheDocument();
  });

  it("renders tabs on notebooks page", () => {
    vi.mocked(usePathname).mockReturnValue(
      "/en-US/platform/experiments-archive/test-experiment-id/analysis/notebooks",
    );

    render(
      <AnalysisLayout>
        <div>Child Content</div>
      </AnalysisLayout>,
    );

    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });
});
