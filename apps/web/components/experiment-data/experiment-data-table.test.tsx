import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { ExperimentDataTable } from "./experiment-data-table";

// Mock the tsr module
vi.mock("@/lib/tsr", () => ({
  tsr: {
    experiments: {
      getExperimentData: {
        useQuery: vi.fn(),
      },
    },
  },
}));

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "experimentDataTable.loading": "Loading...",
        "experimentDataTable.error": "Error loading data",
        "experimentDataTable.noData": "No data available",
        "experimentDataTable.table": "Table",
        "experimentDataTable.totalRows": "Total rows",
        "experimentDataTable.rowsPerPage": "Rows per page",
        "experimentDataTable.page": "Page",
        "experimentDataTable.pageOf": "of",
        "experimentDataTable.previous": "Previous",
        "experimentDataTable.next": "Next",
        "experimentDataTable.noResults": "No results found",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
  Pagination: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  PaginationContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  PaginationItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaginationNext: ({
    children,
    onClick,
    className,
    title,
    ...props
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    className?: string;
    title?: string;
  }) => (
    <button onClick={onClick} className={className} title={title} {...props}>
      {children ?? "Next"}
    </button>
  ),
  PaginationPrevious: ({
    children,
    onClick,
    className,
    title,
    ...props
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    className?: string;
    title?: string;
  }) => (
    <button onClick={onClick} className={className} title={title} {...props}>
      {children ?? "Previous"}
    </button>
  ),
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children: React.ReactNode;
    onValueChange?: (value: string) => void;
    value?: string;
  }) => (
    <select
      data-testid="page-size-select"
      onChange={(e) => onValueChange?.(e.target.value)}
      value={value}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  SelectValue: () => <span>Select value</span>,
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children, ...props }: { children: React.ReactNode; colSpan?: number }) => (
    <td {...props}>{children}</td>
  ),
  TableHead: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <th className={className}>{children}</th>
  ),
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children, ...props }: { children: React.ReactNode }) => (
    <tr {...props}>{children}</tr>
  ),
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dropdown-menu">{children ?? "DropdownMenu"}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dropdown-menu-trigger">{children ?? "DropdownMenuTrigger"}</div>
  ),
  DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dropdown-menu-content">{children ?? "DropdownMenuContent"}</div>
  ),
  DropdownMenuItem: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dropdown-menu-item">{children ?? "DropdownMenuItem"}</div>
  ),
  DropdownMenuSeparator: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="dropdown-menu-separator">{children ?? "DropdownMenuSeparator"}</div>
  ),
  Button: ({ className }: { className?: string }) => (
    <div data-testid="button" className={className} />
  ),
}));

// Mock cn utility
vi.mock("@repo/ui/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

// Mock experiment data utils
vi.mock("~/components/experiment-data/experiment-data-utils", () => ({
  ExperimentDataRows: ({ rows, columnCount }: { rows: unknown[]; columnCount: number }) => (
    <tr data-testid="experiment-data-rows">
      <td colSpan={columnCount}>
        {rows.length === 0 ? "No results found" : `${rows.length} rows`}
      </td>
    </tr>
  ),
  ExperimentTableHeader: ({ headerGroups: _ }: { headerGroups: unknown[] }) => (
    <thead data-testid="experiment-table-header">
      <tr>
        <th>Mocked Header</th>
      </tr>
    </thead>
  ),
  formatValue: (value: unknown, type: string) => {
    if (type === "DOUBLE" || type === "INT") {
      return <div className="text-right">{value as number}</div>;
    }
    return value as string;
  },
  LoadingRows: ({ rowCount, columnCount }: { rowCount: number; columnCount: number }) => (
    <tr data-testid="loading-rows">
      <td colSpan={columnCount}>Loading {rowCount} rows...</td>
    </tr>
  ),
}));

// Mock BulkActionsBar
vi.mock("~/components/experiment-data/comments/bulk-actions-bar", () => ({
  BulkActionsBar: () => <div data-testid="bulk-actions-bar">BulkActionsBar</div>,
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("ExperimentDataTable", () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  const mockTableData = {
    columns: [
      { name: "id", type_name: "INT", type_text: "Integer" },
      { name: "name", type_name: "STRING", type_text: "String" },
    ],
    rows: [
      { id: "1", name: "Test 1" },
      { id: "2", name: "Test 2" },
    ],
    totalRows: 100,
    truncated: false,
  };

  const mockResponse = {
    body: [
      {
        name: "test_table",
        data: mockTableData,
        totalPages: 10,
        totalRows: 100,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Add event listener mocks
    vi.spyOn(window, "addEventListener").mockImplementation(() => {
      // Mock implementation
    });
    vi.spyOn(window, "removeEventListener").mockImplementation(() => {
      // Mock implementation
    });
  });

  it("should render loading state initially", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    render(
      <ExperimentDataTable experimentId="experiment-123" tableName="test_table" pageSize={10} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("should render error state", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("API Error"),
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    render(
      <ExperimentDataTable experimentId="experiment-123" tableName="test_table" pageSize={10} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("Error loading data")).toBeInTheDocument();
  });

  it("should render no data state", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    render(
      <ExperimentDataTable experimentId="experiment-123" tableName="test_table" pageSize={10} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("should render table with data", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockResponse,
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    render(
      <ExperimentDataTable experimentId="experiment-123" tableName="test_table" pageSize={10} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("Table test_table")).toBeInTheDocument();
    expect(screen.getByText("Total rows: 100")).toBeInTheDocument();
    expect(screen.getByTestId("experiment-table-header")).toBeInTheDocument();
    expect(screen.getByTestId("experiment-data-rows")).toBeInTheDocument();
  });

  it("should handle page size change", async () => {
    const user = userEvent.setup();
    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockResponse,
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    render(
      <ExperimentDataTable experimentId="experiment-123" tableName="test_table" pageSize={10} />,
      { wrapper: createWrapper() },
    );

    const pageSizeSelect = screen.getByTestId("page-size-select");
    await user.selectOptions(pageSizeSelect, "20");

    // Should call useQuery with new page size
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        queryData: expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          query: expect.objectContaining({
            pageSize: 20,
            page: 1, // Should reset to page 1
          }),
        }),
      }),
    );
  });

  it("should handle pagination navigation", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockResponse,
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    render(
      <ExperimentDataTable experimentId="experiment-123" tableName="test_table" pageSize={10} />,
      { wrapper: createWrapper() },
    );

    // Test next page button
    const nextButton = screen.getByText("Next");
    fireEvent.click(nextButton);

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        queryData: expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          query: expect.objectContaining({
            page: 2,
          }),
        }),
      }),
    );
  });

  it("should disable navigation buttons appropriately", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: {
        body: [
          {
            name: "test_table",
            data: mockTableData,
            totalPages: 1, // Only one page
            totalRows: 10,
          },
        ],
      },
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    render(
      <ExperimentDataTable experimentId="experiment-123" tableName="test_table" pageSize={10} />,
      { wrapper: createWrapper() },
    );

    const previousButton = screen.getByText("Previous");
    const nextButton = screen.getByText("Next");

    // Both buttons should be disabled when there's only one page and we're on page 1
    expect(previousButton).toHaveClass("pointer-events-none");
    expect(nextButton).toHaveClass("pointer-events-none");
  });

  it("should show loading state while maintaining metadata", () => {
    let isLoading = false;
    const mockUseQuery = vi.fn().mockImplementation(() => ({
      data: isLoading ? undefined : mockResponse,
      isLoading,
      error: null,
    }));
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    // First render with data
    const { rerender } = render(
      <ExperimentDataTable experimentId="experiment-123" tableName="test_table" pageSize={10} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByTestId("experiment-data-rows")).toBeInTheDocument();

    // Then simulate loading state (e.g., when changing pages)
    isLoading = true;
    rerender(
      <ExperimentDataTable experimentId="experiment-123" tableName="test_table" pageSize={10} />,
    );

    // Should show loading rows but maintain table structure
    expect(screen.getByTestId("loading-rows")).toBeInTheDocument();
    expect(screen.getByTestId("experiment-table-header")).toBeInTheDocument();
  });

  it("should call useQuery with correct parameters", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockResponse,
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    render(
      <ExperimentDataTable experimentId="experiment-123" tableName="test_table" pageSize={20} />,
      { wrapper: createWrapper() },
    );

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        params: { id: "experiment-123" },
        query: { tableName: "test_table", page: 1, pageSize: 20 },
      },
      queryKey: ["experiment", "experiment-123", 1, 20, "test_table"],
      staleTime: 120000,
    });
  });
});
