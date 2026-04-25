import { createWorkbook } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { useParams } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";

import WorkbookLayout from "../layout";

// Mock child components to isolate the layout
vi.mock("@/components/workbook-overview/workbook-layout-content", () => ({
  WorkbookLayoutContent: ({ id, children }: { id: string; children: React.ReactNode }) => (
    <div data-testid="workbook-layout-content" data-id={id}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/workbook-overview/workbook-save-context", () => ({
  WorkbookSaveProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock ErrorDisplay used by EntityLayoutShell
vi.mock("@/components/error-display", () => ({
  ErrorDisplay: ({ error }: { error: unknown }) => (
    <div data-testid="error-display">{String(error)}</div>
  ),
}));

const mockUseWorkbook = vi.fn();
vi.mock("@/hooks/workbook/useWorkbook/useWorkbook", () => ({
  useWorkbook: (...args: unknown[]): unknown => mockUseWorkbook(...args),
}));

describe("WorkbookLayout", () => {
  beforeEach(() => {
    vi.mocked(useParams).mockReturnValue({ id: "wb-1", locale: "en-US" });
  });

  it("shows loading state while data is being fetched", () => {
    mockUseWorkbook.mockReturnValue({ data: undefined, isLoading: true, error: null });
    render(<WorkbookLayout>Child</WorkbookLayout>);
    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("renders children inside WorkbookLayoutContent when data is available", () => {
    mockUseWorkbook.mockReturnValue({
      data: createWorkbook({ id: "wb-1", name: "My WB" }),
      isLoading: false,
      error: null,
    });
    render(<WorkbookLayout>Child Content</WorkbookLayout>);
    expect(screen.getByTestId("workbook-layout-content")).toBeInTheDocument();
    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });

  it("passes the workbook id to WorkbookLayoutContent", () => {
    mockUseWorkbook.mockReturnValue({
      data: createWorkbook({ id: "wb-1" }),
      isLoading: false,
      error: null,
    });
    render(<WorkbookLayout>Child</WorkbookLayout>);
    expect(screen.getByTestId("workbook-layout-content")).toHaveAttribute("data-id", "wb-1");
  });

  it("renders error state when hook returns an error", () => {
    mockUseWorkbook.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { status: 500, message: "Server error" },
    });
    render(<WorkbookLayout>Child</WorkbookLayout>);
    expect(screen.getByText("errors.error")).toBeInTheDocument();
  });

  it("renders nothing when no data and not loading", () => {
    mockUseWorkbook.mockReturnValue({ data: undefined, isLoading: false, error: null });
    const { container } = render(<WorkbookLayout>Child</WorkbookLayout>);
    // EntityLayoutShell returns null when !hasData
    expect(screen.queryByText("Child")).not.toBeInTheDocument();
    expect(container.querySelector(".workbook-page")).toBeInTheDocument();
  });
});
