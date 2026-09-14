import { createExperimentAccess, createExperimentDashboard } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { use } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import ExperimentOverviewPage from "./experiment-overview-content";

// Dashboard thumbnails defer rendering until in view. Scoped to this file rather
// than the shared setup: adding it globally woke a dormant observer in the
// navbar and broke its test.
beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    vi.fn(function (callback: IntersectionObserverCallback) {
      return {
        observe: (target: Element) => {
          callback(
            [{ isIntersecting: true, target } as IntersectionObserverEntry],
            {} as IntersectionObserver,
          );
        },
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      };
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ title }: { title: string }) => <div role="alert">{title}</div>,
}));
vi.mock("~/components/experiment-overview/experiment-description", () => ({
  ExperimentDescription: () => <section aria-label="description" />,
}));
vi.mock("~/components/experiment-overview/experiment-details/experiment-details-card", () => ({
  ExperimentDetailsCard: () => <section aria-label="details" />,
}));
vi.mock("~/components/experiment-overview/experiment-measurements", () => ({
  ExperimentMeasurements: () => <section aria-label="measurements" />,
}));
vi.mock("~/components/experiment-overview/experiment-linked-workbook", () => ({
  ExperimentLinkedWorkbook: () => <section aria-label="workbook" />,
}));

const accessPayload = createExperimentAccess({
  isAdmin: true,
  experiment: { id: "test-id", name: "T", description: "d", status: "active" },
});

function mountDefaults({ dashboards = [] }: { dashboards?: unknown[] } = {}) {
  server.mount(contract.experiments.getExperimentAccess, { body: accessPayload });
  server.mount(contract.experiments.getExperimentLocations, { body: [] });
  server.mount(contract.experiments.listExperimentContributors, {
    body: { contributors: [], collaboratorCount: 0 },
  });
  server.mount(contract.experiments.listExperimentDashboards, { body: dashboards });
}

describe("ExperimentOverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(use).mockReturnValue({ id: "test-id" });
  });

  const props = { params: Promise.resolve({ id: "test-id" }) };

  it("shows loading state", () => {
    mountDefaults();
    render(<ExperimentOverviewPage {...props} />);
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("shows error display on failure", async () => {
    server.mount(contract.experiments.getExperimentAccess, { status: 500 });
    server.mount(contract.experiments.getExperimentLocations, { body: [] });
    server.mount(contract.experiments.listExperimentContributors, {
      body: { contributors: [], collaboratorCount: 0 },
    });
    server.mount(contract.experiments.listExperimentDashboards, { body: [] });
    render(<ExperimentOverviewPage {...props} />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("failedToLoad");
    });
  });

  it("renders experiment sections on success", async () => {
    mountDefaults();
    render(<ExperimentOverviewPage {...props} />);
    await waitFor(() => {
      expect(screen.getByRole("region", { name: /details/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("region", { name: /description/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /workbook/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /measurements/i })).toBeInTheDocument();
  });

  // A flex row reports the sum of its items' min-content as its own, and each
  // carousel slide carries a full-width card, so the column's minimum grew with
  // every dashboard until it pushed the 24rem details panel off-screen. Measured
  // at 1440px, where the row has 1152px: four dashboards asked 1112px, five asked
  // 1339px. jsdom has no layout engine, so this renders the five-slide tree that
  // produced the overflow and pins the class that lets the column shrink; the
  // widths themselves were checked in a browser.
  it("keeps the content column shrinkable with a carousel of five dashboards", async () => {
    mountDefaults({
      dashboards: Array.from({ length: 5 }, (_, i) =>
        createExperimentDashboard({ name: `Dashboard ${i + 1}` }),
      ),
    });
    const { container } = render(<ExperimentOverviewPage {...props} />);

    await waitFor(() => {
      expect(screen.getByRole("region", { name: /details/i })).toBeInTheDocument();
    });
    // The real carousel renders here, so the slides are the actual source of the
    // min-content sum rather than a stand-in.
    await waitFor(() => {
      expect(container.querySelectorAll('[aria-roledescription="slide"]')).toHaveLength(5);
    });

    const column = container.querySelector('[class*="lg:order-1"]');
    expect(column).toHaveClass("min-w-0", "flex-1");
  });
});
