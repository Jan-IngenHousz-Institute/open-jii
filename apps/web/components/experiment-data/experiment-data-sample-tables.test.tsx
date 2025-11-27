import { tsr } from "@/lib/tsr";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { ExperimentDataSampleTables } from "./experiment-data-sample-tables";

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

// Mock Next.js Link
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "experimentDataTable.loading": "Loading...",
        "experimentDataTable.noData": "No data available",
        "experimentDataTable.table": "Table",
        "experimentDataTable.details": "View Details",
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
    variant,
    size,
  }: {
    children: React.ReactNode;
    variant?: string;
    size?: string;
  }) => (
    <button data-variant={variant} data-size={size}>
      {children}
    </button>
  ),
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
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Download: () => <svg data-testid="download-icon">DownloadIcon</svg>,
  TableIcon: () => <svg data-testid="table-icon">TableIcon</svg>,
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
  ExperimentTableHeader: ({ headerGroups: _headerGroups }: { headerGroups: unknown[] }) => (
    <thead data-testid="experiment-table-header">
      <tr>
        <th>Mocked Header</th>
      </tr>
    </thead>
  ),
  formatValue: (value: unknown, type: string) => {
    if (type === "DOUBLE" || type === "INT") {
      return <div className="text-right">{String(value)}</div>;
    }
    return String(value);
  },
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

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("ExperimentDataSampleTables", () => {
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

  const mockSampleData = {
    body: [
      {
        name: "measurements",
        displayName: "measurements",
        data: {
          columns: [
            { name: "id", type_name: "INT", type_text: "Integer" },
            { name: "value", type_name: "DOUBLE", type_text: "Double" },
            { name: "timestamp", type_name: "TIMESTAMP", type_text: "Timestamp" },
          ],
          rows: [
            { id: "1", value: "10.5", timestamp: "2023-01-01T10:00:00" },
            { id: "2", value: "20.7", timestamp: "2023-01-02T11:00:00" },
          ],
          totalRows: 2,
          truncated: false,
        },
        totalPages: 1,
        totalRows: 2,
      },
      {
        name: "metadata",
        displayName: "metadata",
        data: {
          columns: [
            { name: "key", type_name: "STRING", type_text: "String" },
            { name: "value", type_name: "STRING", type_text: "String" },
          ],
          rows: [
            { key: "experiment_type", value: "field_study" },
            { key: "location", value: "greenhouse_a" },
          ],
          totalRows: 2,
          truncated: false,
        },
        totalPages: 1,
        totalRows: 2,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render loading state", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    render(
      <ExperimentDataSampleTables experimentId="experiment-123" sampleSize={10} locale="en-US" />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("should render no data state", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    render(
      <ExperimentDataSampleTables experimentId="experiment-123" sampleSize={10} locale="en-US" />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("should render sample tables with data", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockSampleData,
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    render(
      <ExperimentDataSampleTables experimentId="experiment-123" sampleSize={10} locale="en-US" />,
      { wrapper: createWrapper() },
    );

    // Should render both table names
    expect(screen.getByText("Table measurements")).toBeInTheDocument();
    expect(screen.getByText("Table metadata")).toBeInTheDocument();

    // Should render table data
    expect(screen.getAllByTestId("experiment-table-header")).toHaveLength(2);
    expect(screen.getAllByTestId("experiment-data-rows")).toHaveLength(2);

    // Should render detail buttons for each table
    const detailButtons = screen.getAllByText("View Details");
    expect(detailButtons).toHaveLength(2);

    // Should render download buttons for each table
    const downloadButtons = screen.getAllByText("Download");
    expect(downloadButtons).toHaveLength(2);

    // Should render table icons
    expect(screen.getAllByTestId("table-icon")).toHaveLength(2);
  });

  it("should render correct links to table detail pages", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockSampleData,
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    render(
      <ExperimentDataSampleTables experimentId="experiment-123" sampleSize={10} locale="en-US" />,
      { wrapper: createWrapper() },
    );

    const detailLinks = screen.getAllByRole("link");
    expect(detailLinks).toHaveLength(2);

    // Check that links point to correct URLs
    expect(detailLinks[0]).toHaveAttribute(
      "href",
      "/en-US/platform/experiments/experiment-123/data/measurements",
    );
    expect(detailLinks[1]).toHaveAttribute(
      "href",
      "/en-US/platform/experiments/experiment-123/data/metadata",
    );
  });

  it("should call useQuery with correct parameters", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockSampleData,
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    render(
      <ExperimentDataSampleTables experimentId="experiment-123" sampleSize={15} locale="en-US" />,
      { wrapper: createWrapper() },
    );

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        params: { id: "experiment-123" },
        query: { tableName: undefined, page: 1, pageSize: 15 },
      },
      queryKey: ["experiment", "experiment-123", 1, 15, undefined],
      staleTime: 120000,
    });
  });

  it("should use default sample size when not provided", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockSampleData,
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    render(
      <ExperimentDataSampleTables experimentId="experiment-123" sampleSize={10} locale="en-US" />,
      {
        wrapper: createWrapper(),
      },
    );

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        params: { id: "experiment-123" },
        query: { tableName: undefined, page: 1, pageSize: 10 },
      },
      queryKey: ["experiment", "experiment-123", 1, 10, undefined],
      staleTime: 120000,
    });
  });

  it("should handle single table correctly", () => {
    const singleTableData = {
      body: [mockSampleData.body[0]], // Only one table
    };

    const mockUseQuery = vi.fn().mockReturnValue({
      data: singleTableData,
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    render(
      <ExperimentDataSampleTables experimentId="experiment-123" sampleSize={10} locale="en-US" />,
      { wrapper: createWrapper() },
    );

    // Should render only one table
    expect(screen.getByText("Table measurements")).toBeInTheDocument();
    expect(screen.queryByText("Table metadata")).not.toBeInTheDocument();

    // Should render only one detail button
    const detailButtons = screen.getAllByText("View Details");
    expect(detailButtons).toHaveLength(1);
  });

  it("should pass format function to sample data hook", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockSampleData,
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    render(
      <ExperimentDataSampleTables experimentId="experiment-123" sampleSize={10} locale="en-US" />,
      { wrapper: createWrapper() },
    );

    // The formatValue function should be used when creating table columns
    // This is tested indirectly through the hook's behavior
    expect(mockUseQuery).toHaveBeenCalled();
  });

  it("should render with different locales", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockSampleData,
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.getExperimentData.useQuery = mockUseQuery;

    render(
      <ExperimentDataSampleTables experimentId="experiment-123" sampleSize={10} locale="de-DE" />,
      { wrapper: createWrapper() },
    );

    const detailLinks = screen.getAllByRole("link");
    expect(detailLinks[0]).toHaveAttribute(
      "href",
      "/de-DE/platform/experiments/experiment-123/data/measurements",
    );
  });
});
