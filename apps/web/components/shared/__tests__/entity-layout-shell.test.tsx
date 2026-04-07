import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { EntityLayoutShell } from "../entity-layout-shell";

// ---------- Mocks ----------
import { notFound } from "next/navigation";

const mockNotFound = vi.mocked(notFound);

vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ error, title }: { error: unknown; title?: string }) => (
    <div data-testid="error-display" data-title={title}>
      {JSON.stringify(error)}
    </div>
  ),
}));

// ---------- Helpers ----------
interface RenderOptions {
  isLoading?: boolean;
  error?: unknown;
  hasData?: boolean;
  loadingMessage?: string;
  errorDescription?: string;
  children?: React.ReactNode;
}

function renderComponent(options: RenderOptions = {}) {
  const {
    isLoading = false,
    error = undefined,
    hasData = false,
    loadingMessage,
    errorDescription,
    children = <div data-testid="children-content">Children</div>,
  } = options;

  return render(
    <EntityLayoutShell
      isLoading={isLoading}
      error={error}
      hasData={hasData}
      loadingMessage={loadingMessage}
      errorDescription={errorDescription}
    >
      {children}
    </EntityLayoutShell>,
  );
}

// ---------- Tests ----------
describe("EntityLayoutShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------- Loading state ----------
  it("shows loading message when isLoading is true", () => {
    renderComponent({ isLoading: true });
    expect(screen.getByText("common.loading")).toBeInTheDocument();
    expect(screen.queryByTestId("children-content")).not.toBeInTheDocument();
  });

  it("shows custom loadingMessage when provided", () => {
    renderComponent({ isLoading: true, loadingMessage: "Fetching data..." });
    expect(screen.getByText("Fetching data...")).toBeInTheDocument();
    expect(screen.queryByText("common.loading")).not.toBeInTheDocument();
  });

  // ---------- Error states ----------
  it("calls notFound for 404 error", () => {
    renderComponent({ error: { status: 404 } });
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("calls notFound for 400 error", () => {
    renderComponent({ error: { status: 400 } });
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("shows ErrorDisplay for 500 error", () => {
    renderComponent({ error: { status: 500 } });
    expect(screen.getByTestId("error-display")).toBeInTheDocument();
    expect(screen.getByText("errors.error")).toBeInTheDocument();
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it("shows custom errorDescription when provided", () => {
    renderComponent({
      error: { status: 500 },
      errorDescription: "Something went terribly wrong.",
    });
    expect(screen.getByText("Something went terribly wrong.")).toBeInTheDocument();
  });

  it("shows default error description when not provided", () => {
    renderComponent({ error: { status: 500 } });
    expect(screen.getByText("errors.resourceNotFoundMessage")).toBeInTheDocument();
  });

  // ---------- No data state ----------
  it("returns null when hasData is false and no error", () => {
    const { container } = renderComponent({ hasData: false });
    expect(container.innerHTML).toBe("");
    expect(screen.queryByTestId("children-content")).not.toBeInTheDocument();
  });

  // ---------- Success state ----------
  it("renders children when hasData is true", () => {
    renderComponent({ hasData: true });
    expect(screen.getByTestId("children-content")).toBeInTheDocument();
    expect(screen.getByText("Children")).toBeInTheDocument();
  });
});
