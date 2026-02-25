import { createExperimentAccess } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { usePathname, useParams, notFound } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";

import ExperimentLayout from "./layout";

vi.mock("~/components/experiment-overview/experiment-title", () => ({
  ExperimentTitle: ({ name }: { name: string }) => <h1>{name}</h1>,
}));

vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ title }: { title: string }) => <div role="alert">{title}</div>,
}));

describe("ExperimentLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue("/en-US/platform/experiments/test-id");
    vi.mocked(useParams).mockReturnValue({ id: "test-id" } as never);
  });

  const renderLayout = () =>
    render(
      <ExperimentLayout>
        <div data-testid="child">Child</div>
      </ExperimentLayout>,
    );

  it("shows loading state", () => {
    server.mount(contract.experiments.getExperimentAccess, {
      body: createExperimentAccess(),
      delay: 999_999,
    });
    renderLayout();
    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });

  it("shows access denied for 403 errors", async () => {
    server.mount(contract.experiments.getExperimentAccess, { status: 403 });
    renderLayout();
    await waitFor(() => {
      expect(screen.getByText("errors.accessDenied")).toBeInTheDocument();
    });
  });

  it("shows generic error for server errors", async () => {
    server.mount(contract.experiments.getExperimentAccess, { status: 500 });
    renderLayout();
    await waitFor(
      () => {
        expect(screen.getByText("errors.error")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it("calls notFound for 404 errors", async () => {
    server.mount(contract.experiments.getExperimentAccess, { status: 404 });
    renderLayout();
    await waitFor(() => {
      expect(vi.mocked(notFound)).toHaveBeenCalled();
    });
  });

  it("shows not-found when experiment data is missing", async () => {
    server.mount(contract.experiments.getExperimentAccess, {
      body: { experiment: null, hasAccess: false, isAdmin: false },
    });
    renderLayout();
    await waitFor(() => {
      expect(screen.getByText("errors.notFound")).toBeInTheDocument();
    });
    expect(screen.getByText("experimentNotFound")).toBeInTheDocument();
  });

  it("renders title, tabs, and children on success", async () => {
    server.mount(contract.experiments.getExperimentAccess, {
      body: createExperimentAccess({
        experiment: {
          id: "test-id",
          name: "Test Experiment",
          status: "active",
          visibility: "private",
        },
        isAdmin: true,
      }),
    });
    renderLayout();
    await waitFor(() => {
      expect(screen.getByText("Test Experiment")).toBeInTheDocument();
    });
    expect(screen.getByText("overview")).toBeInTheDocument();
    expect(screen.getByText("data")).toBeInTheDocument();
    expect(screen.getByText("analysis.title")).toBeInTheDocument();
    expect(screen.getByText("flow.tabLabel")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
