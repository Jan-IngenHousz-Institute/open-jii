import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import ExperimentLayout from "./layout";

// Override global next/navigation mock with customisable fns
const mockUsePathname = vi.fn().mockReturnValue("/en-US/platform/experiments/test-id");
const mockUseParams = vi.fn().mockReturnValue({ id: "test-id" });
const mockNotFound = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => mockUsePathname(),
  useParams: () => mockUseParams(),
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
  notFound: (...args: unknown[]) => mockNotFound(...args),
}));

const mockUseExperimentAccess = vi.fn();
vi.mock("@/hooks/experiment/useExperimentAccess/useExperimentAccess", () => ({
  useExperimentAccess: (...args: unknown[]) => mockUseExperimentAccess(...args),
}));

vi.mock("@/hooks/useLocale", () => ({ useLocale: () => "en-US" }));

vi.mock("~/components/experiment-overview/experiment-title", () => ({
  ExperimentTitle: ({ name }: { name: string }) => <h1>{name}</h1>,
}));

vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ title }: { title: string }) => <div role="alert">{title}</div>,
}));

const experiment = {
  id: "test-id",
  name: "Test Experiment",
  status: "active",
  visibility: "private",
};

describe("ExperimentLayout", () => {
  beforeEach(() => vi.clearAllMocks());

  const renderLayout = (hookOverrides: Record<string, unknown> = {}) => {
    mockUseExperimentAccess.mockReturnValue({
      data: { body: { experiment, isAdmin: true } },
      isLoading: false,
      error: null,
      ...hookOverrides,
    });
    return render(
      <ExperimentLayout>
        <div data-testid="child">Child</div>
      </ExperimentLayout>,
    );
  };

  it("shows loading state", () => {
    renderLayout({ data: null, isLoading: true });
    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(screen.queryByTestId("child")).not.toBeInTheDocument();
  });

  it("shows access denied for 403 errors", () => {
    renderLayout({ data: null, error: { status: 403 } });
    expect(screen.getByText("errors.accessDenied")).toBeInTheDocument();
  });

  it("shows generic error for server errors", () => {
    renderLayout({ data: null, error: { status: 500 } });
    expect(screen.getByText("errors.error")).toBeInTheDocument();
  });

  it("calls notFound for 404 errors", () => {
    renderLayout({ data: null, error: { status: 404 } });
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("shows not-found when experiment data is missing", () => {
    mockUseExperimentAccess.mockReturnValue({ data: null, isLoading: false, error: null });
    render(
      <ExperimentLayout>
        <div />
      </ExperimentLayout>,
    );
    expect(screen.getByText("errors.notFound")).toBeInTheDocument();
    expect(screen.getByText("experimentNotFound")).toBeInTheDocument();
  });

  it("renders title, tabs, and children on success", () => {
    renderLayout();
    expect(screen.getByText("Test Experiment")).toBeInTheDocument();
    expect(screen.getByText("overview")).toBeInTheDocument();
    expect(screen.getByText("data")).toBeInTheDocument();
    expect(screen.getByText("analysis.title")).toBeInTheDocument();
    expect(screen.getByText("flow.tabLabel")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
