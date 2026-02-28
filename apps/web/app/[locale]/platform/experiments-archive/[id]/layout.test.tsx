import { useLocale } from "@/hooks/useLocale";
import { createExperimentAccess } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { usePathname, useParams, notFound } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";

import ExperimentLayout from "./layout";

vi.mock("~/components/experiment-overview/experiment-title", () => ({
  ExperimentTitle: ({ name }: { name: string }) => <div data-testid="experiment-title">{name}</div>,
}));

vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ title }: { title: string }) => <div role="alert">{title}</div>,
}));

const defaultAccess = createExperimentAccess({
  experiment: {
    id: "test-id",
    name: "Test Experiment",
    status: "active",
    visibility: "private",
  },
});

const renderLayout = (children: React.ReactNode = <div>Child Content</div>) =>
  render(<ExperimentLayout>{children}</ExperimentLayout>);

describe("<ExperimentLayout />", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/experiments-archive/test-id");
    vi.mocked(useParams).mockReturnValue({ id: "test-id" } as never);
  });

  describe("Loading State", () => {
    it("shows loading message when data is loading", () => {
      server.mount(contract.experiments.getExperimentAccess, {
        body: defaultAccess,
        delay: 999_999,
      });
      renderLayout();

      expect(screen.getByText("loading")).toBeInTheDocument();
      expect(screen.queryByText("Child Content")).not.toBeInTheDocument();
    });
  });

  describe("Error States", () => {
    it("shows access denied error for 403 status", async () => {
      server.mount(contract.experiments.getExperimentAccess, { status: 403 });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByText("errors.accessDenied")).toBeInTheDocument();
      });
      expect(screen.getByText("noPermissionToAccess")).toBeInTheDocument();
      expect(screen.queryByText("Child Content")).not.toBeInTheDocument();
    });

    it("shows generic error for non-403 errors", async () => {
      server.mount(contract.experiments.getExperimentAccess, { status: 500 });
      renderLayout();

      await waitFor(
        () => {
          expect(screen.getByText("errors.error")).toBeInTheDocument();
        },
        { timeout: 5000 },
      );
      expect(screen.getByText("errorLoadingExperiment")).toBeInTheDocument();
      expect(screen.queryByText("Child Content")).not.toBeInTheDocument();
    });

    it("calls notFound for 404 status", async () => {
      server.mount(contract.experiments.getExperimentAccess, { status: 404 });
      renderLayout();

      await waitFor(() => {
        expect(vi.mocked(notFound)).toHaveBeenCalled();
      });
    });
  });

  describe("No Data State", () => {
    it("shows not found message when no experiment data is returned", async () => {
      server.mount(contract.experiments.getExperimentAccess, {
        body: { experiment: null, hasAccess: false, isAdmin: false },
      });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByText("errors.notFound")).toBeInTheDocument();
      });
      expect(screen.getByText("experimentNotFound")).toBeInTheDocument();
      expect(screen.queryByText("Child Content")).not.toBeInTheDocument();
    });
  });

  describe("Tab Navigation", () => {
    it("renders all tabs with correct labels", async () => {
      server.mount(contract.experiments.getExperimentAccess, {
        body: createExperimentAccess({ isAdmin: true, experiment: { id: "test-id" } }),
      });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByText("overview")).toBeInTheDocument();
      });
      expect(screen.getByText("data")).toBeInTheDocument();
      expect(screen.getByText("analysis.title")).toBeInTheDocument();
      expect(screen.getByText("flow.tabLabel")).toBeInTheDocument();
    });

    it("all tabs render as links with correct hrefs", async () => {
      server.mount(contract.experiments.getExperimentAccess, {
        body: createExperimentAccess({ isAdmin: true, experiment: { id: "test-id" } }),
      });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByText("overview")).toBeInTheDocument();
      });

      const links = screen.getAllByRole("link");
      const hrefs = links.map((l) => l.getAttribute("href"));

      expect(hrefs).toContain("/en-US/platform/experiments-archive/test-id");
      expect(hrefs).toContain("/en-US/platform/experiments-archive/test-id/data");
      expect(hrefs).toContain("/en-US/platform/experiments-archive/test-id/analysis");
      expect(hrefs).toContain("/en-US/platform/experiments-archive/test-id/flow");
    });

    it("renders tabs when on root experiment path", async () => {
      server.mount(contract.experiments.getExperimentAccess, { body: defaultAccess });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByText("overview")).toBeInTheDocument();
      });
      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });

    it("renders tabs when on data path", async () => {
      vi.mocked(usePathname).mockReturnValue("/en-US/platform/experiments/test-id/data");
      server.mount(contract.experiments.getExperimentAccess, { body: defaultAccess });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByText("data")).toBeInTheDocument();
      });
      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });

    it("renders tabs when on analysis path", async () => {
      vi.mocked(usePathname).mockReturnValue(
        "/en-US/platform/experiments/test-id/analysis/visualizations",
      );
      server.mount(contract.experiments.getExperimentAccess, { body: defaultAccess });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByText("analysis.title")).toBeInTheDocument();
      });
      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });

    it("renders tabs when on flow path", async () => {
      vi.mocked(usePathname).mockReturnValue("/en-US/platform/experiments/test-id/flow");
      server.mount(contract.experiments.getExperimentAccess, { body: defaultAccess });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByText("flow.tabLabel")).toBeInTheDocument();
      });
      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });
  });

  describe("Layout Content", () => {
    it("renders children", async () => {
      server.mount(contract.experiments.getExperimentAccess, { body: defaultAccess });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByText("Child Content")).toBeInTheDocument();
      });
    });
  });

  describe("Different Locales", () => {
    it("generates correct links for different locale", async () => {
      vi.mocked(useParams).mockReturnValue({ id: "test-id" } as never);
      vi.mocked(usePathname).mockReturnValue("/de/platform/experiments-archive/test-id");
      vi.mocked(useLocale).mockReturnValue("de");
      server.mount(contract.experiments.getExperimentAccess, {
        body: createExperimentAccess({ isAdmin: true, experiment: { id: "test-id" } }),
      });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByText("overview")).toBeInTheDocument();
      });

      const links = screen.getAllByRole("link");
      const hrefs = links.map((l) => l.getAttribute("href"));

      expect(hrefs).toContain("/de/platform/experiments-archive/test-id");
      expect(hrefs).toContain("/de/platform/experiments-archive/test-id/data");
      expect(hrefs).toContain("/de/platform/experiments-archive/test-id/analysis");
      expect(hrefs).toContain("/de/platform/experiments-archive/test-id/flow");
    });

    it("renders tabs for different locale", async () => {
      vi.mocked(usePathname).mockReturnValue("/de/platform/experiments/test-id/data/sensors");
      vi.mocked(useParams).mockReturnValue({ id: "test-id" } as never);
      vi.mocked(useLocale).mockReturnValue("de");
      server.mount(contract.experiments.getExperimentAccess, { body: defaultAccess });
      renderLayout();

      await waitFor(() => {
        expect(screen.getByText("data")).toBeInTheDocument();
      });
      expect(screen.getByText("Child Content")).toBeInTheDocument();
    });
  });
});
