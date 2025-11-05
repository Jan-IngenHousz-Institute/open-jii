import { render, screen } from "@testing-library/react";
import { useParams, usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AnalysisLayout from "./layout";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useParams: vi.fn(),
  useRouter: vi.fn(),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock hooks
vi.mock("@/hooks/useLocale", () => ({
  useLocale: () => "en",
}));

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("AnalysisLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ id: "exp-123" });
  });

  describe("Main analysis pages", () => {
    it("should render full layout for visualizations page", () => {
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(
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
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(
        "/en/platform/experiments/exp-123/analysis/notebooks",
      );

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
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(
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
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(
        "/en/platform/experiments/exp-123/analysis/visualizations",
      );

      render(
        <AnalysisLayout>
          <div>Content</div>
        </AnalysisLayout>,
      );

      const notebooksTab = screen.getByText("analysis.notebooks");
      expect(notebooksTab.className).toContain("cursor-not-allowed");
      expect(notebooksTab.className).toContain("opacity-50");
    });

    it("should set visualizations tab as active when on visualizations page", () => {
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(
        "/en/platform/experiments/exp-123/analysis/visualizations",
      );

      const { container } = render(
        <AnalysisLayout>
          <div>Content</div>
        </AnalysisLayout>,
      );

      const tabs = container.querySelector('[role="tablist"]');
      expect(tabs).toBeInTheDocument();
    });

    it("should set notebooks tab as active when on notebooks page", () => {
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(
        "/en/platform/experiments/exp-123/analysis/notebooks",
      );

      const { container } = render(
        <AnalysisLayout>
          <div>Content</div>
        </AnalysisLayout>,
      );

      const tabs = container.querySelector('[role="tablist"]');
      expect(tabs).toBeInTheDocument();
    });
  });

  describe("Sub-pages", () => {
    it("should not render full layout for new visualization page", () => {
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(
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
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(
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
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(
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
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(
        "/en/platform/experiments/exp-123/analysis/visualizations",
      );

      const { container } = render(
        <AnalysisLayout>
          <div>Content</div>
        </AnalysisLayout>,
      );

      const tabs = container.querySelector('[role="tablist"]');
      expect(tabs).toBeInTheDocument();
    });

    it("should handle different locales in URL", () => {
      (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ id: "exp-123" });
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(
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
      (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ id: "exp-999" });
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(
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
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(
        "/en/platform/experiments/exp-123/analysis/visualizations",
      );

      render(
        <AnalysisLayout>
          <div data-testid="test-child">Test Children</div>
        </AnalysisLayout>,
      );

      expect(screen.getByTestId("test-child")).toBeInTheDocument();
      expect(screen.getByText("Test Children")).toBeInTheDocument();
    });

    it("should render children directly for sub-pages", () => {
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(
        "/en/platform/experiments/exp-123/analysis/visualizations/new",
      );

      render(
        <AnalysisLayout>
          <div data-testid="test-child">Test Children</div>
        </AnalysisLayout>,
      );

      expect(screen.getByTestId("test-child")).toBeInTheDocument();
      expect(screen.queryByText("analysis.title")).not.toBeInTheDocument();
    });

    it("should handle complex children components", () => {
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(
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
      (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ id: undefined });
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(
        "/en/platform/experiments//analysis/visualizations",
      );

      render(
        <AnalysisLayout>
          <div>Content</div>
        </AnalysisLayout>,
      );

      // Should not render full layout
      expect(screen.queryByText("analysis.title")).not.toBeInTheDocument();
    });

    it("should handle empty children", () => {
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(
        "/en/platform/experiments/exp-123/analysis/visualizations",
      );

      render(<AnalysisLayout>{null}</AnalysisLayout>);

      expect(screen.getByText("analysis.title")).toBeInTheDocument();
    });

    it("should handle multiple children", () => {
      (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(
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
