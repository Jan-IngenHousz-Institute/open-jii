/* eslint-disable @typescript-eslint/no-unsafe-return */
import { useLocale } from "@/hooks/useLocale";
import { render, screen } from "@/test/test-utils";
import { usePathname, useParams } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";

import ExperimentLayout from "./layout";

// -------------------
// Mocks
// -------------------

// Mock useExperimentAccess hook
const mockUseExperimentAccess = vi.fn();
vi.mock("@/hooks/experiment/useExperimentAccess/useExperimentAccess", () => ({
  useExperimentAccess: (id: string) => mockUseExperimentAccess(id),
}));

// Mock ExperimentTitle component
vi.mock("~/components/experiment-overview/experiment-title", () => ({
  ExperimentTitle: ({ name }: { name: string }) => <div data-testid="experiment-title">{name}</div>,
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
  children = <div>Child Content</div>,
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
  // Mock navigation hooks (globally mocked)
  vi.mocked(usePathname).mockReturnValue(pathname);
  vi.mocked(useParams).mockReturnValue({ id: experimentId });
  vi.mocked(useLocale).mockReturnValue(locale);

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
      expect(screen.queryByText("Child Content")).not.toBeInTheDocument();
    });
  });

  describe("Error States", () => {
    it("shows access denied error for 403 status", () => {
      const error = { status: 403, message: "Forbidden" };
      renderExperimentLayout({ error });

      expect(screen.getByText("errors.accessDenied")).toBeInTheDocument();
      expect(screen.getByText("noPermissionToAccess")).toBeInTheDocument();
      expect(screen.queryByText("Child Content")).not.toBeInTheDocument();
    });

    it("shows generic error for non-403 errors", () => {
      const error = { status: 500, message: "Internal Server Error" };
      renderExperimentLayout({ error });

      expect(screen.getByText("errors.error")).toBeInTheDocument();
      expect(screen.getByText("errorLoadingExperiment")).toBeInTheDocument();
      expect(screen.queryByText("Child Content")).not.toBeInTheDocument();
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
      vi.mocked(usePathname).mockReturnValue("/en/platform/experiments-archive/test-id");
      vi.mocked(useParams).mockReturnValue({ id: "test-id" });
      vi.mocked(useLocale).mockReturnValue("en");
      mockUseExperimentAccess.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      render(
        <ExperimentLayout>
          <div>Child Content</div>
        </ExperimentLayout>,
      );

      expect(screen.getByText("errors.notFound")).toBeInTheDocument();
      expect(screen.getByText("experimentNotFound")).toBeInTheDocument();
      expect(screen.queryByText("Child Content")).not.toBeInTheDocument();
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

    it("all tabs render as links with correct hrefs", () => {
      renderExperimentLayout({ isAdmin: true, locale: "en", experimentId: "test-id" });

      const links = screen.getAllByRole("link");
      const hrefs = links.map((l) => l.getAttribute("href"));

      expect(hrefs).toContain("/en/platform/experiments-archive/test-id");
      expect(hrefs).toContain("/en/platform/experiments-archive/test-id/data");
      expect(hrefs).toContain("/en/platform/experiments-archive/test-id/analysis");
      expect(hrefs).toContain("/en/platform/experiments-archive/test-id/flow");
    });

    it("renders tabs when on root experiment path", () => {
      renderExperimentLayout({
        pathname: "/en/platform/experiments-archive/test-id",
        experimentId: "test-id",
      });

      expect(screen.getByText("overview")).toBeInTheDocument();
      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });

    it("renders tabs when on data path", () => {
      renderExperimentLayout({
        pathname: "/en/platform/experiments/test-id/data",
        experimentId: "test-id",
      });

      expect(screen.getByText("data")).toBeInTheDocument();
      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });

    it("renders tabs when on analysis path", () => {
      renderExperimentLayout({
        pathname: "/en/platform/experiments/test-id/analysis/visualizations",
        experimentId: "test-id",
      });

      expect(screen.getByText("analysis.title")).toBeInTheDocument();
      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });

    it("renders tabs when on flow path", () => {
      renderExperimentLayout({
        pathname: "/en/platform/experiments/test-id/flow",
        experimentId: "test-id",
      });

      expect(screen.getByText("flow.tabLabel")).toBeInTheDocument();
      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });
  });

  describe("Layout Content", () => {
    it("renders children", () => {
      renderExperimentLayout();

      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });
  });

  describe("Hook Integration", () => {
    it("calls useExperimentAccess with correct experiment ID", () => {
      renderExperimentLayout({ experimentId: "my-experiment-123" });

      expect(mockUseExperimentAccess).toHaveBeenCalledWith("my-experiment-123");
    });
  });

  describe("Different Locales", () => {
    it("generates correct links for different locale", () => {
      renderExperimentLayout({
        isAdmin: true,
        locale: "de",
        experimentId: "test-id",
      });

      const links = screen.getAllByRole("link");
      const hrefs = links.map((l) => l.getAttribute("href"));

      expect(hrefs).toContain("/de/platform/experiments-archive/test-id");
      expect(hrefs).toContain("/de/platform/experiments-archive/test-id/data");
      expect(hrefs).toContain("/de/platform/experiments-archive/test-id/analysis");
      expect(hrefs).toContain("/de/platform/experiments-archive/test-id/flow");
    });

    it("renders tabs for different locale", () => {
      renderExperimentLayout({
        pathname: "/de/platform/experiments/test-id/data/sensors",
        experimentId: "test-id",
        locale: "de",
      });

      expect(screen.getByText("data")).toBeInTheDocument();
      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });
  });
});
