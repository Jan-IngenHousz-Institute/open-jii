import { createExperimentDataTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import type { ExperimentData } from "@repo/api";
import { WellKnownColumnTypes, contract } from "@repo/api";

import { getColumnWidth, useExperimentData } from "./useExperimentData";

/* ------------------------------------------------------------------ */
/*  getColumnWidth (pure function – no MSW needed)                     */
/* ------------------------------------------------------------------ */

describe("getColumnWidth", () => {
  it("should return 120 for ARRAY column type", () => {
    expect(getColumnWidth("ARRAY")).toBe(120);
  });

  it("should return 120 for ARRAY with generic type", () => {
    expect(getColumnWidth("ARRAY<STRING>")).toBe(120);
    expect(getColumnWidth("ARRAY<NUMBER>")).toBe(120);
    expect(getColumnWidth("ARRAY<INT>")).toBe(120);
  });

  it("should return 180 for MAP column type", () => {
    expect(getColumnWidth("MAP")).toBe(180);
  });

  it("should return 180 for MAP with STRING key type", () => {
    expect(getColumnWidth("MAP<STRING,")).toBe(180);
    expect(getColumnWidth("MAP<STRING,INT>")).toBe(180);
    expect(getColumnWidth("MAP<STRING,DOUBLE>")).toBe(180);
  });

  it("should return undefined for other column types", () => {
    expect(getColumnWidth("STRING")).toBeUndefined();
    expect(getColumnWidth("NUMBER")).toBeUndefined();
    expect(getColumnWidth("DOUBLE")).toBeUndefined();
    expect(getColumnWidth("INT")).toBeUndefined();
    expect(getColumnWidth("TIMESTAMP")).toBeUndefined();
    expect(getColumnWidth("BOOLEAN")).toBeUndefined();
    expect(getColumnWidth("ANNOTATIONS")).toBeUndefined();
  });

  it("should return undefined for empty string", () => {
    expect(getColumnWidth("")).toBeUndefined();
  });

  it("should return 180 for MAP with STRING key and space", () => {
    expect(getColumnWidth("MAP<STRING, STRING>")).toBe(180);
    expect(getColumnWidth("MAP<STRING, INT>")).toBe(180);
  });

  it("should return 180 for ARRAY<STRUCT<...>> column type", () => {
    expect(getColumnWidth("ARRAY<STRUCT<question_label: STRING>>")).toBe(180);
    expect(getColumnWidth("ARRAY<STRUCT<name: STRING, age: INT>>")).toBe(180);
    expect(
      getColumnWidth(
        "ARRAY<STRUCT<question_label: STRING, question_text: STRING, question_answer: STRING>>",
      ),
    ).toBe(180);
  });

  it("should return 120 for other ARRAY types", () => {
    expect(getColumnWidth("ARRAY")).toBe(120);
    expect(getColumnWidth("ARRAY<DOUBLE>")).toBe(120);
    expect(getColumnWidth("ARRAY<STRING>")).toBe(120);
  });

  it("should return 180 for USER column type", () => {
    expect(getColumnWidth(WellKnownColumnTypes.CONTRIBUTOR)).toBe(180);
  });
});

/* ------------------------------------------------------------------ */
/*  useExperimentData (MSW-backed integration tests)                   */
/* ------------------------------------------------------------------ */

describe("useExperimentData", () => {
  const mockExperimentData: ExperimentData = {
    columns: [
      { name: "id", type_name: "INT", type_text: "INT" },
      { name: "name", type_name: "STRING", type_text: "STRING" },
      { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
      { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
    ],
    rows: [
      { id: "1", name: "Test 1", value: "10.5", timestamp: "2023-01-01T10:00:00" },
      { id: "2", name: "Test 2", value: "20.7", timestamp: "2023-01-02T11:00:00" },
    ],
    totalRows: 2,
    truncated: false,
  };

  function mountData(body?: unknown, opts?: { status?: number }) {
    return server.mount(contract.experiments.getExperimentData, {
      body: body ?? [
        createExperimentDataTable({
          name: "test_table",
          data: mockExperimentData,
          totalPages: 5,
          totalRows: 100,
        }),
      ],
      ...(opts?.status ? { status: opts.status } : {}),
    });
  }

  it("should return table metadata and rows when data is available", async () => {
    mountData();

    const { result } = renderHook(() =>
      useExperimentData({
        experimentId: "experiment-123",
        page: 1,
        pageSize: 20,
        tableName: "test_table",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tableMetadata).toEqual({
      columns: expect.arrayContaining([
        expect.objectContaining({
          accessorKey: "id",
          header: "id",
          meta: { type: "INT" },
        }),
        expect.objectContaining({
          accessorKey: "name",
          header: "name",
          meta: { type: "STRING" },
        }),
        expect.objectContaining({
          accessorKey: "value",
          header: "value",
          meta: { type: "DOUBLE" },
        }),
        expect.objectContaining({
          accessorKey: "timestamp",
          header: "timestamp",
          meta: { type: "TIMESTAMP" },
        }),
      ]),
      totalPages: 5,
      totalRows: 100,
      errorColumn: undefined,
      rawColumns: expect.arrayContaining([
        expect.objectContaining({ name: "id", type_name: "INT" }),
        expect.objectContaining({ name: "name", type_name: "STRING" }),
        expect.objectContaining({ name: "value", type_name: "DOUBLE" }),
        expect.objectContaining({ name: "timestamp", type_name: "TIMESTAMP" }),
      ]),
    });
    expect(result.current.tableRows).toEqual(mockExperimentData.rows);
    expect(result.current.error).toBeNull();
  });

  it("should start in loading state before data arrives", async () => {
    mountData();

    const { result } = renderHook(() =>
      useExperimentData({
        experimentId: "experiment-123",
        page: 1,
        pageSize: 20,
        tableName: "test_table",
      }),
    );

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.tableMetadata).toBeUndefined();
    expect(result.current.tableRows).toBeUndefined();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("should handle error state", async () => {
    server.mount(contract.experiments.getExperimentData, { status: 500 });

    const { result } = renderHook(() =>
      useExperimentData({
        experimentId: "experiment-123",
        page: 1,
        pageSize: 20,
        tableName: "test_table",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tableMetadata).toBeUndefined();
    expect(result.current.tableRows).toBeUndefined();
    expect(result.current.error).not.toBeNull();
  });

  it("should sort columns by type precedence correctly", async () => {
    const mixedData: ExperimentData = {
      columns: [
        { name: "chart_data", type_name: "ARRAY", type_text: "ARRAY<DOUBLE>" },
        {
          name: "struct_data",
          type_name: "ARRAY",
          type_text: "ARRAY<STRUCT<name: STRING, age: INT>>",
        },
        { name: "id", type_name: "INT", type_text: "INT" },
        {
          name: "annotations",
          type_name: "ARRAY",
          type_text:
            "ARRAY<STRUCT<id: STRING, rowId: STRING, type: STRING, content: STRUCT<text: STRING, flagType: STRING>, createdBy: STRING, createdByName: STRING, createdAt: TIMESTAMP, updatedAt: TIMESTAMP>>",
        },
        { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
        { name: "map_data", type_name: "MAP", type_text: "MAP<STRING, STRING>" },
        { name: "name", type_name: "STRING", type_text: "STRING" },
        { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
        { name: "count", type_name: "INT", type_text: "INT" },
        { name: "amount", type_name: "BIGINT", type_text: "BIGINT" },
        { name: "other", type_name: "UNKNOWN", type_text: "UNKNOWN" },
      ],
      rows: [
        {
          chart_data: "[1,2,3]",
          struct_data: '[{"name": "John", "age": 30}]',
          id: "1",
          annotations: "[]",
          timestamp: "2023-01-01T10:00:00",
          map_data: '{"key1": "value1", "key2": "value2"}',
          name: "Test",
          value: "10.5",
          count: "5",
          amount: "1000000",
          other: "something",
        },
      ],
      totalRows: 1,
      truncated: false,
    };

    mountData([
      createExperimentDataTable({
        name: "test_table",
        data: mixedData,
        totalPages: 1,
        totalRows: 1,
      }),
    ]);

    const { result } = renderHook(() =>
      useExperimentData({
        experimentId: "experiment-123",
        page: 1,
        pageSize: 20,
        tableName: "test_table",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const columnOrder = result.current.tableMetadata?.columns.map((col) => col.accessorKey);
    expect(columnOrder).toEqual([
      "timestamp",
      "struct_data",
      "annotations",
      "map_data",
      "name",
      "id",
      "value",
      "count",
      "amount",
      "chart_data",
      "other",
    ]);
  });

  it("should set smaller width for array columns", async () => {
    const arrayData: ExperimentData = {
      columns: [
        { name: "temperature", type_name: "INT", type_text: "INT" },
        { name: "chart_data", type_name: "ARRAY", type_text: "ARRAY<DOUBLE>" },
        { name: "array_data", type_name: "ARRAY", type_text: "ARRAY<STRING>" },
        { name: "name", type_name: "STRING", type_text: "STRING" },
      ],
      rows: [{ id: "1", chart_data: "[1,2,3]", array_data: "[a,b,c]", name: "Test" }],
      totalRows: 1,
      truncated: false,
    };

    mountData([
      createExperimentDataTable({
        name: "test_table",
        data: arrayData,
        totalPages: 1,
        totalRows: 1,
      }),
    ]);

    const { result } = renderHook(() =>
      useExperimentData({
        experimentId: "experiment-123",
        page: 1,
        pageSize: 20,
        tableName: "test_table",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const columns = result.current.tableMetadata?.columns;
    expect(columns).toBeDefined();

    const chartColumn = columns?.find((col) => col.accessorKey === "chart_data");
    const arrayColumn = columns?.find((col) => col.accessorKey === "array_data");
    const stringColumn = columns?.find((col) => col.accessorKey === "name");

    expect(chartColumn?.size).toBe(120);
    expect(arrayColumn?.size).toBe(120);
    expect(stringColumn?.size).toBeUndefined();
  });

  it("should handle empty data gracefully", async () => {
    mountData([
      createExperimentDataTable({
        name: "test_table",
        data: { columns: [], rows: [], totalRows: 0, truncated: false },
        totalPages: 0,
        totalRows: 0,
      }),
    ]);

    const { result } = renderHook(() =>
      useExperimentData({
        experimentId: "experiment-123",
        page: 1,
        pageSize: 20,
        tableName: "test_table",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tableMetadata).toEqual({
      columns: [],
      totalPages: 0,
      totalRows: 0,
      errorColumn: undefined,
      rawColumns: [],
    });
    expect(result.current.tableRows).toEqual([]);
  });

  it("should handle empty body array gracefully", async () => {
    mountData([]);

    const { result } = renderHook(() =>
      useExperimentData({
        experimentId: "experiment-123",
        page: 1,
        pageSize: 20,
        tableName: "test_table",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tableMetadata).toBeUndefined();
    expect(result.current.tableRows).toBeUndefined();
  });
});
