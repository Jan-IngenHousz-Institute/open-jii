import { useLocale } from "@/hooks/useLocale";
import { render, screen } from "@/test/test-utils";
import { useParams, usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AnalysisLayout from "./layout";

describe("AnalysisLayout", () => {
  beforeEach(() => {
    vi.mocked(useLocale).mockReturnValue("en");
    vi.mocked(useParams).mockReturnValue({ id: "exp-123" });
  });

  describe("Main analysis pages", () => {
    it("renders heading + description for visualizations page", () => {
      vi.mocked(usePathname).mockReturnValue(
        "/en/platform/experiments/exp-123/analysis/visualizations",
      );

      render(
        <AnalysisLayout>
          <div>Visualizations Content</div>
        </AnalysisLayout>,
      );

      expect(screen.getByText("analysis.title")).toBeInTheDocument();
      expect(screen.getByText("analysis.description")).toBeInTheDocument();
      expect(screen.getByText("Visualizations Content")).toBeInTheDocument();
    });

    it("renders heading + description for notebooks page", () => {
      vi.mocked(usePathname).mockReturnValue("/en/platform/experiments/exp-123/analysis/notebooks");

      render(
        <AnalysisLayout>
          <div>Notebooks Content</div>
        </AnalysisLayout>,
      );

      expect(screen.getByText("analysis.title")).toBeInTheDocument();
      expect(screen.getByText("analysis.description")).toBeInTheDocument();
      expect(screen.getByText("Notebooks Content")).toBeInTheDocument();
    });

    it("does not render the legacy NavTabs sub-bar (segmented switcher lives in the page now)", () => {
      vi.mocked(usePathname).mockReturnValue(
        "/en/platform/experiments/exp-123/analysis/visualizations",
      );

      render(
        <AnalysisLayout>
          <div>Content</div>
        </AnalysisLayout>,
      );

      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    });
  });

  describe("Sub-pages", () => {
    it("does not render heading for new visualization page", () => {
      vi.mocked(usePathname).mockReturnValue(
        "/en/platform/experiments/exp-123/analysis/visualizations/new",
      );

      render(
        <AnalysisLayout>
          <div>New Visualization Form</div>
        </AnalysisLayout>,
      );

      expect(screen.queryByText("analysis.title")).not.toBeInTheDocument();
      expect(screen.queryByText("analysis.description")).not.toBeInTheDocument();
      expect(screen.getByText("New Visualization Form")).toBeInTheDocument();
    });

    it("does not render heading for visualization detail page", () => {
      vi.mocked(usePathname).mockReturnValue(
        "/en/platform/experiments/exp-123/analysis/visualizations/viz-456",
      );

      render(
        <AnalysisLayout>
          <div>Visualization Details</div>
        </AnalysisLayout>,
      );

      expect(screen.queryByText("analysis.title")).not.toBeInTheDocument();
      expect(screen.getByText("Visualization Details")).toBeInTheDocument();
    });

    it("does not render heading for edit visualization page", () => {
      vi.mocked(usePathname).mockReturnValue(
        "/en/platform/experiments/exp-123/analysis/visualizations/viz-456/edit",
      );

      render(
        <AnalysisLayout>
          <div>Edit Visualization Form</div>
        </AnalysisLayout>,
      );

      expect(screen.queryByText("analysis.title")).not.toBeInTheDocument();
      expect(screen.getByText("Edit Visualization Form")).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("does not render heading when experiment ID is missing", () => {
      vi.mocked(useParams).mockReturnValue({ id: undefined });
      vi.mocked(usePathname).mockReturnValue("/en/platform/experiments//analysis/visualizations");

      render(
        <AnalysisLayout>
          <div>Content</div>
        </AnalysisLayout>,
      );

      // Pathname doesn't match any expected main-page URL, so the heading
      // wrapper is skipped.
      expect(screen.queryByText("analysis.title")).not.toBeInTheDocument();
    });

    it("renders children passed in", () => {
      vi.mocked(usePathname).mockReturnValue(
        "/en/platform/experiments/exp-123/analysis/visualizations",
      );

      render(
        <AnalysisLayout>
          <div>First Child</div>
          <div>Second Child</div>
        </AnalysisLayout>,
      );

      expect(screen.getByText("First Child")).toBeInTheDocument();
      expect(screen.getByText("Second Child")).toBeInTheDocument();
    });
  });
});
