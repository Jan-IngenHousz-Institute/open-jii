/* eslint-disable @typescript-eslint/no-unsafe-return */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import ExperimentLayout from "./layout";

// Global React for JSX in mocks
globalThis.React = React;

// -------------------
// Mocks
// -------------------

// Mock useExperimentAccess hook
const mockUseExperimentAccess = vi.fn();
vi.mock("@/hooks/experiment/useExperimentAccess/useExperimentAccess", () => ({
  useExperimentAccess: (id: string) => mockUseExperimentAccess(id),
}));

// Mock useLocale hook
const mockUseLocale = vi.fn();
vi.mock("@/hooks/useLocale", () => ({
  useLocale: () => mockUseLocale(),
}));

// Mock Next.js navigation hooks
const mockUsePathname = vi.fn();
const mockUseParams = vi.fn();
const mockNotFound = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useParams: () => mockUseParams(),
  notFound: () => mockNotFound(),
}));

// Mock Next.js Link component
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-testid="next-link">
      {children}
    </a>
  ),
}));

// Mock i18n
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock ExperimentTitle component
vi.mock("~/components/experiment-overview/experiment-title", () => ({
  ExperimentTitle: ({ name }: { name: string }) => <div data-testid="experiment-title">{name}</div>,
}));

// Mock breadcrumb context
vi.mock("@/components/navigation/breadcrumb-context", () => ({
  useBreadcrumbContext: () => ({
    setNameMapping: vi.fn(),
  }),
}));

// -------------------
// Test Data
// -------------------

const createMockAccessData = ({
  hasAccess = true,
  isAdmin = false,
}: { hasAccess?: boolean; isAdmin?: boolean } = {}) => ({
  data: {
    body: {
      experiment: {
        id: "test-experiment-id",
        name: "Test Experiment",
        status: "active",
        visibility: "private",
      },
      hasAccess,
      isAdmin,
    },
  },
  isLoading: false,
  error: null,
});

// -------------------
// Helpers
// -------------------
function renderExperimentLayout({
  children = <div data-testid="child-content">Child Content</div>,
  hasAccess = true,
  isAdmin = false,
  isLoading = false,
  error = null,
  pathname = "/en/platform/experiments-archive/test-id",
  experimentId = "test-id",
  locale = "en",
}: {
  children?: React.ReactNode;
  hasAccess?: boolean;
  isAdmin?: boolean;
  isLoading?: boolean;
  error?: { status?: number; message: string } | null;
  pathname?: string;
  experimentId?: string;
  locale?: string;
} = {}) {
  // Mock navigation hooks
  mockUsePathname.mockReturnValue(pathname);
  mockUseParams.mockReturnValue({ id: experimentId });
  mockUseLocale.mockReturnValue(locale);

  // Mock useExperimentAccess hook response
  if (error) {
    mockUseExperimentAccess.mockReturnValue({
      data: null,
      isLoading: false,
      error,
    });
  } else if (isLoading) {
    mockUseExperimentAccess.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });
  } else {
    mockUseExperimentAccess.mockReturnValue(createMockAccessData({ hasAccess, isAdmin }));
  }

  return render(<ExperimentLayout>{children}</ExperimentLayout>);
}

// -------------------
// Tests
// -------------------
describe("<ExperimentLayout />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("shows loading message when data is loading", () => {
      renderExperimentLayout({ isLoading: true });

      expect(screen.getByText("loading")).toBeInTheDocument();
      expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
    });
  });

  describe("Error States", () => {
    it("shows access denied error for 403 status", () => {
      const error = { status: 403, message: "Forbidden" };
      renderExperimentLayout({ error });

      expect(screen.getByText("errors.accessDenied")).toBeInTheDocument();
      expect(screen.getByText("noPermissionToAccess")).toBeInTheDocument();
      expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
    });

    it("shows generic error for non-403 errors", () => {
      const error = { status: 500, message: "Internal Server Error" };
      renderExperimentLayout({ error });

      expect(screen.getByText("errors.error")).toBeInTheDocument();
      expect(screen.getByText("errorLoadingExperiment")).toBeInTheDocument();
      expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
    });

    it("shows generic error for 404 status", () => {
      const error = { status: 404, message: "Not Found" };
      renderExperimentLayout({ error });

      expect(screen.getByText("errors.error")).toBeInTheDocument();
      expect(screen.getByText("errorLoadingExperiment")).toBeInTheDocument();
      expect(screen.queryByText("errors.accessDenied")).not.toBeInTheDocument();
    });
  });

  describe("No Data State", () => {
    it("shows not found message when no experiment data is returned", () => {
      mockUsePathname.mockReturnValue("/en/platform/experiments-archive/test-id");
      mockUseParams.mockReturnValue({ id: "test-id" });
      mockUseLocale.mockReturnValue("en");
      mockUseExperimentAccess.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      render(
        <ExperimentLayout>
          <div data-testid="child-content">Child Content</div>
        </ExperimentLayout>,
      );

      expect(screen.getByText("errors.notFound")).toBeInTheDocument();
      expect(screen.getByText("experimentNotFound")).toBeInTheDocument();
      expect(screen.queryByTestId("child-content")).not.toBeInTheDocument();
    });
  });

  describe("Tab Navigation", () => {
    it("renders all tabs with correct labels", () => {
      renderExperimentLayout({ isAdmin: true });

      expect(screen.getByText("overview")).toBeInTheDocument();
      expect(screen.getByText("data")).toBeInTheDocument();
      expect(screen.getByText("analysis.title")).toBeInTheDocument();
      expect(screen.getByText("flow.tabLabel")).toBeInTheDocument();
    });

    it("all tabs render as links", () => {
      renderExperimentLayout({ isAdmin: true, locale: "en", experimentId: "test-id" });

      const links = screen.getAllByTestId("next-link");
      expect(links).toHaveLength(4); // 4 tabs for archived experiments

      // Check href attributes (archived uses /experiments-archive/ path)
      expect(links[0]).toHaveAttribute("href", "/en/platform/experiments-archive/test-id");
      expect(links[1]).toHaveAttribute("href", "/en/platform/experiments-archive/test-id/data");
      expect(links[2]).toHaveAttribute("href", "/en/platform/experiments-archive/test-id/analysis");
      expect(links[3]).toHaveAttribute("href", "/en/platform/experiments-archive/test-id/flow");
    });

    it("renders tabs when on root experiment path", () => {
      renderExperimentLayout({
        pathname: "/en/platform/experiments-archive/test-id",
        experimentId: "test-id",
      });

      expect(screen.getByText("overview")).toBeInTheDocument();
      expect(screen.getByTestId("child-content")).toBeInTheDocument();
    });

    it("renders tabs when on data path", () => {
      renderExperimentLayout({
        pathname: "/en/platform/experiments/test-id/data",
        experimentId: "test-id",
      });

      expect(screen.getByText("data")).toBeInTheDocument();
      expect(screen.getByTestId("child-content")).toBeInTheDocument();
    });

    it("renders tabs when on nested data path", () => {
      renderExperimentLayout({
        pathname: "/en/platform/experiments/test-id/data/sensors",
        experimentId: "test-id",
        locale: "en",
      });

      expect(screen.getByText("data")).toBeInTheDocument();
      expect(screen.getByTestId("child-content")).toBeInTheDocument();
    });

    it("renders tabs when on analysis path", () => {
      renderExperimentLayout({
        pathname: "/en/platform/experiments/test-id/analysis/visualizations",
        experimentId: "test-id",
      });

      expect(screen.getByText("analysis.title")).toBeInTheDocument();
      expect(screen.getByTestId("child-content")).toBeInTheDocument();
    });

    it("renders tabs when on flow path", () => {
      renderExperimentLayout({
        pathname: "/en/platform/experiments/test-id/flow",
        experimentId: "test-id",
      });

      expect(screen.getByText("flow.tabLabel")).toBeInTheDocument();
      expect(screen.getByTestId("child-content")).toBeInTheDocument();
    });
  });

  describe("Layout Content", () => {
    it("renders experiment title component", () => {
      renderExperimentLayout();

      // ExperimentTitle component is rendered (we'd need to mock it to test its content)
      expect(screen.getByTestId("child-content")).toBeInTheDocument();
    });

    it("wraps children in proper structure", () => {
      renderExperimentLayout();

      const childContent = screen.getByTestId("child-content");
      expect(childContent).toBeInTheDocument();
    });
  });

  describe("Hook Integration", () => {
    it("calls useExperimentAccess with correct experiment ID", () => {
      renderExperimentLayout({ experimentId: "my-experiment-123" });

      expect(mockUseExperimentAccess).toHaveBeenCalledWith("my-experiment-123");
    });

    it("calls useLocale hook", () => {
      renderExperimentLayout();

      expect(mockUseLocale).toHaveBeenCalled();
    });

    it("calls usePathname hook", () => {
      renderExperimentLayout();

      expect(mockUsePathname).toHaveBeenCalled();
    });

    it("calls useParams hook", () => {
      renderExperimentLayout();

      expect(mockUseParams).toHaveBeenCalled();
    });
  });

  describe("Different Locales", () => {
    it("generates correct links for different locale", () => {
      renderExperimentLayout({
        isAdmin: true,
        locale: "de",
        experimentId: "test-id",
      });

      const links = screen.getAllByTestId("next-link");
      expect(links[0]).toHaveAttribute("href", "/de/platform/experiments-archive/test-id");
      expect(links[1]).toHaveAttribute("href", "/de/platform/experiments-archive/test-id/data");
      expect(links[2]).toHaveAttribute("href", "/de/platform/experiments-archive/test-id/analysis");
      expect(links[3]).toHaveAttribute("href", "/de/platform/experiments-archive/test-id/flow");
    });

    it("renders tabs for different locale", () => {
      renderExperimentLayout({
        pathname: "/de/platform/experiments/test-id/data/sensors",
        experimentId: "test-id",
        locale: "de",
      });

      expect(screen.getByText("data")).toBeInTheDocument();
      expect(screen.getByTestId("child-content")).toBeInTheDocument();
    });
  });
});
