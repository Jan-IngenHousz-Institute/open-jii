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
    it("should render full layout for visualizations page", () => {
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
      expect(screen.getByText("analysis.visualizations")).toBeInTheDocument();
      expect(screen.getByText("analysis.notebooks")).toBeInTheDocument();
      expect(screen.getByText("Visualizations Content")).toBeInTheDocument();
    });

    it("should render full layout for notebooks page", () => {
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

    it("should have visualizations tab link to correct URL", () => {
      vi.mocked(usePathname).mockReturnValue(
        "/en/platform/experiments/exp-123/analysis/visualizations",
      );

      render(
        <AnalysisLayout>
          <div>Content</div>
        </AnalysisLayout>,
      );

      const visualizationsLink = screen.getByText("analysis.visualizations").closest("a");
      expect(visualizationsLink).toBeTruthy();
      expect(visualizationsLink?.getAttribute("href")).toContain(
        "/en/platform/experiments/exp-123/analysis/visualizations",
      );
    });

    it("should disable notebooks tab", () => {
      vi.mocked(usePathname).mockReturnValue(
        "/en/platform/experiments/exp-123/analysis/visualizations",
      );

      render(
        <AnalysisLayout>
          <div>Content</div>
        </AnalysisLayout>,
      );

      const notebooksTab = screen.getByRole("tab", { name: /analysis.notebooks/ });
      expect(notebooksTab).toBeDisabled();
    });

    it("should set visualizations tab as active when on visualizations page", () => {
      vi.mocked(usePathname).mockReturnValue(
        "/en/platform/experiments/exp-123/analysis/visualizations",
      );

      render(
        <AnalysisLayout>
          <div>Content</div>
        </AnalysisLayout>,
      );

      expect(screen.getByRole("tablist")).toBeInTheDocument();
    });

    it("should set notebooks tab as active when on notebooks page", () => {
      vi.mocked(usePathname).mockReturnValue("/en/platform/experiments/exp-123/analysis/notebooks");

      render(
        <AnalysisLayout>
          <div>Content</div>
        </AnalysisLayout>,
      );

      expect(screen.getByRole("tablist")).toBeInTheDocument();
    });
  });

  describe("Sub-pages", () => {
    it("should not render full layout for new visualization page", () => {
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

    it("should not render full layout for visualization detail page", () => {
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

    it("should not render full layout for edit visualization page", () => {
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

  describe("Active tab detection", () => {
    it("should default to visualizations tab when path doesn't include notebooks", () => {
      vi.mocked(usePathname).mockReturnValue(
        "/en/platform/experiments/exp-123/analysis/visualizations",
      );

      render(
        <AnalysisLayout>
          <div>Content</div>
        </AnalysisLayout>,
      );

      expect(screen.getByRole("tablist")).toBeInTheDocument();
    });

    it("should handle different locales in URL", () => {
      vi.mocked(useParams).mockReturnValue({ id: "exp-123" });
      vi.mocked(usePathname).mockReturnValue(
        "/de/platform/experiments/exp-123/analysis/visualizations",
      );

      render(
        <AnalysisLayout>
          <div>Content</div>
        </AnalysisLayout>,
      );

      // Should not render full layout since locale is different
      expect(screen.queryByText("analysis.title")).not.toBeInTheDocument();
    });

    it("should handle different experiment IDs in URL", () => {
      vi.mocked(useParams).mockReturnValue({ id: "exp-999" });
      vi.mocked(usePathname).mockReturnValue(
        "/en/platform/experiments/exp-999/analysis/visualizations",
      );

      render(
        <AnalysisLayout>
          <div>Content</div>
        </AnalysisLayout>,
      );

      expect(screen.getByText("analysis.title")).toBeInTheDocument();
      const visualizationsLink = screen.getByText("analysis.visualizations").closest("a");
      expect(visualizationsLink).toBeTruthy();
      expect(visualizationsLink?.getAttribute("href")).toContain(
        "/en/platform/experiments/exp-999/analysis",
      );
    });
  });

  describe("Children rendering", () => {
    it("should render children in tabs content area for main pages", () => {
      vi.mocked(usePathname).mockReturnValue(
        "/en/platform/experiments/exp-123/analysis/visualizations",
      );

      render(
        <AnalysisLayout>
          <div>Test Children</div>
        </AnalysisLayout>,
      );

      expect(screen.getByText("Test Children")).toBeInTheDocument();
    });

    it("should render children directly for sub-pages", () => {
      vi.mocked(usePathname).mockReturnValue(
        "/en/platform/experiments/exp-123/analysis/visualizations/new",
      );

      render(
        <AnalysisLayout>
          <div>Test Children</div>
        </AnalysisLayout>,
      );

      expect(screen.getByText("Test Children")).toBeInTheDocument();
      expect(screen.queryByText("analysis.title")).not.toBeInTheDocument();
    });

    it("should handle complex children components", () => {
      vi.mocked(usePathname).mockReturnValue(
        "/en/platform/experiments/exp-123/analysis/visualizations",
      );

      render(
        <AnalysisLayout>
          <div>
            <h2>Child Header</h2>
            <p>Child Paragraph</p>
            <button>Child Button</button>
          </div>
        </AnalysisLayout>,
      );

      expect(screen.getByText("Child Header")).toBeInTheDocument();
      expect(screen.getByText("Child Paragraph")).toBeInTheDocument();
      expect(screen.getByText("Child Button")).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("should handle missing experiment ID", () => {
      vi.mocked(useParams).mockReturnValue({ id: undefined });
      vi.mocked(usePathname).mockReturnValue("/en/platform/experiments//analysis/visualizations");

      render(
        <AnalysisLayout>
          <div>Content</div>
        </AnalysisLayout>,
      );

      // Should not render full layout
      expect(screen.queryByText("analysis.title")).not.toBeInTheDocument();
    });

    it("should handle empty children", () => {
      vi.mocked(usePathname).mockReturnValue(
        "/en/platform/experiments/exp-123/analysis/visualizations",
      );

      render(<AnalysisLayout>{null}</AnalysisLayout>);

      expect(screen.getByText("analysis.title")).toBeInTheDocument();
    });

    it("should handle multiple children", () => {
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
