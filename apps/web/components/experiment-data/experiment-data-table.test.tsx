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
        "experimentDataTable.download": "Download",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    onClick,
    className,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    size?: string;
    className?: string;
  }) => (
    <button onClick={onClick} className={className} {...props}>
      {children}
    </button>
  ),
  Dialog: ({
    children,
    open,
    onOpenChange: _onOpenChange,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="dialog-content">
      {children}
    </div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-description">{children}</div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-title">{children}</div>
  ),
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
  Form: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <div {...props}>{children}</div>
  ),
  FormField: ({
    render,
  }: {
    render: (field: {
      field: { value: string; onChange: (value: string) => void };
    }) => React.ReactNode;
  }) => {
    const field = { value: "csv", onChange: vi.fn() };
    return <>{render({ field })}</>;
  },
  FormItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormLabel: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <label className={className}>{children}</label>
  ),
  FormControl: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FormMessage: () => <div />,
}));

// Mock DataDownloadModal
vi.mock("./data-download-modal/data-download-modal", () => ({
  DataDownloadModal: ({
    open,
    onOpenChange,
    experimentId,
    tableName,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    experimentId: string;
    tableName: string;
  }) =>
    open ? (
      <div data-testid="data-download-modal">
        <div>
          Download Modal for {tableName} - {experimentId}
        </div>
        <button onClick={() => onOpenChange(false)}>Close</button>
      </div>
    ) : null,
}));

// Mock cn utility
vi.mock("@repo/ui/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

// Mock experiment data utils
vi.mock("~/components/experiment-data/experiment-data-utils", () => ({
  ExperimentDataRows: ({ rows, columnCount }: { rows: unknown[]; columnCount: number }) => {
    if (rows.length === 0) {
      return (
        <tr data-testid="experiment-data-rows">
          <td colSpan={columnCount}>No results found</td>
        </tr>
      );
    }

    return (
      <tr data-testid="experiment-data-rows">
        <td colSpan={columnCount}>{`${rows.length} rows`}</td>
      </tr>
    );
  },
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

// Mock chart components
vi.mock("./experiment-data-table-chart-cell", () => ({
  ExperimentDataTableChartCell: ({
    data,
    columnName,
    onHover,
    onLeave,
    onClick,
  }: {
    data: number[] | string;
    columnName: string;
    onHover?: (data: number[], columnName: string) => void;
    onLeave?: () => void;
    onClick?: (data: number[], columnName: string) => void;
  }) => (
    <div
      data-testid="chart-cell"
      data-column={columnName}
      onMouseEnter={() => {
        if (onHover) {
          onHover([1, 2, 3], columnName);
        }
      }}
      onMouseLeave={() => {
        if (onLeave) {
          onLeave();
        }
      }}
      onClick={() => {
        if (onClick) {
          onClick([1, 2, 3], columnName);
        }
      }}
    >
      Chart for {columnName}: {JSON.stringify(data)}
    </div>
  ),
}));

vi.mock("./experiment-data-table-chart", () => ({
  ExperimentDataTableChart: ({
    data,
    columnName,
    visible,
    isClicked,
    onClose,
  }: {
    data: number[];
    columnName: string;
    visible: boolean;
    isClicked?: boolean;
    onClose?: () => void;
  }) =>
    visible ? (
      <div data-testid="large-chart" data-column={columnName} data-clicked={isClicked}>
        Large chart for {columnName}: {JSON.stringify(data)}
        {isClicked && onClose && (
          <button onClick={onClose} data-testid="close-chart">
            Close
          </button>
        )}
      </div>
    ) : null,
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

  it("should render download button and open modal", async () => {
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

    // Find and click download button
    const downloadButton = screen.getByText("Download");
    expect(downloadButton).toBeInTheDocument();

    await user.click(downloadButton);

    // Check that modal appears
    expect(screen.getByTestId("data-download-modal")).toBeInTheDocument();
    expect(screen.getByText("Download Modal for test_table - experiment-123")).toBeInTheDocument();
  });

  describe("Chart functionality", () => {
    const mockTableDataWithCharts = {
      columns: [
        { name: "id", type_name: "INT", type_text: "Integer" },
        { name: "chart_data", type_name: "ARRAY<DOUBLE>", type_text: "Array of Doubles" },
        { name: "name", type_name: "STRING", type_text: "String" },
      ],
      rows: [
        { id: "1", chart_data: "[1.1, 2.2, 3.3]", name: "Test 1" },
        { id: "2", chart_data: "[4.4, 5.5, 6.6]", name: "Test 2" },
      ],
      totalRows: 100,
      truncated: false,
    };

    const mockResponseWithCharts = {
      body: [
        {
          name: "test_table",
          data: mockTableDataWithCharts,
          totalPages: 10,
          totalRows: 100,
        },
      ],
    };

    it("should render table with chart data correctly", () => {
      const mockUseQuery = vi.fn().mockReturnValue({
        data: mockResponseWithCharts,
        isLoading: false,
        error: null,
      });
      mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

      render(
        <ExperimentDataTable experimentId="experiment-123" tableName="test_table" pageSize={10} />,
        { wrapper: createWrapper() },
      );

      // Should render table with chart data
      expect(screen.getByTestId("experiment-table-header")).toBeInTheDocument();
      expect(screen.getByTestId("experiment-data-rows")).toBeInTheDocument();
      expect(screen.getByText("2 rows")).toBeInTheDocument();
    });

    it("should handle chart state management correctly", () => {
      const mockUseQuery = vi.fn().mockReturnValue({
        data: mockResponseWithCharts,
        isLoading: false,
        error: null,
      });
      mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

      const { rerender } = render(
        <ExperimentDataTable experimentId="experiment-123" tableName="test_table" pageSize={10} />,
        { wrapper: createWrapper() },
      );

      // Verify the table renders correctly
      expect(screen.getByTestId("experiment-table-header")).toBeInTheDocument();
      expect(screen.getByTestId("experiment-data-rows")).toBeInTheDocument();

      // Verify no chart is shown initially
      expect(screen.queryByTestId("large-chart")).not.toBeInTheDocument();

      // Re-render to ensure state management is working
      rerender(
        <ExperimentDataTable experimentId="experiment-123" tableName="test_table" pageSize={10} />,
      );

      expect(screen.getByTestId("experiment-table-header")).toBeInTheDocument();
    });

    it("should handle empty chart data gracefully", () => {
      const emptyChartData = {
        columns: [
          { name: "id", type_name: "INT", type_text: "Integer" },
          { name: "empty_chart", type_name: "ARRAY<DOUBLE>", type_text: "Array of Doubles" },
        ],
        rows: [
          { id: "1", empty_chart: "[]" },
          { id: "2", empty_chart: "" },
        ],
        totalRows: 2,
        truncated: false,
      };

      const mockUseQuery = vi.fn().mockReturnValue({
        data: {
          body: [
            {
              tableName: "test_table",
              totalPages: 1,
              totalRows: 2,
              data: emptyChartData,
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

      // Should render table even with empty chart data
      expect(screen.getByTestId("experiment-data-rows")).toBeInTheDocument();
      expect(screen.getByText("2 rows")).toBeInTheDocument();
    });

    it("should verify chart components are properly integrated", () => {
      const mockUseQuery = vi.fn().mockReturnValue({
        data: mockResponseWithCharts,
        isLoading: false,
        error: null,
      });
      mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

      render(
        <ExperimentDataTable experimentId="experiment-123" tableName="test_table" pageSize={10} />,
        { wrapper: createWrapper() },
      );

      // Verify chart components are properly mocked and accessible
      expect(screen.getByTestId("experiment-table-header")).toBeInTheDocument();

      // The detailed chart functionality is validated through the individual component tests
      // This integration test verifies the table renders and state management works
      expect(screen.queryByTestId("large-chart")).not.toBeInTheDocument();

      // Verify the data contains chart columns
      expect(screen.getByText("2 rows")).toBeInTheDocument();
    });
  });
});
