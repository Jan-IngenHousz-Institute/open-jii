import { createExperimentDataTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useExperimentVisualizationData } from "./useExperimentVisualizationData";

describe("useExperimentVisualizationData", () => {
  it("should return successful data and table info", async () => {
    server.mount(contract.experiments.getExperimentData, {
      body: [
        createExperimentDataTable({
          name: "measurements",
          catalog_name: "catalog1",
          schema_name: "schema1",
          totalRows: 1000,
          data: {
            columns: [
              { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
              { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
            ],
            rows: [
              { timestamp: "2024-01-01", value: 123.45 },
              { timestamp: "2024-01-02", value: 234.56 },
            ],
            totalRows: 1000,
            truncated: false,
          },
        }),
      ],
    });

    const { result } = renderHook(() =>
      useExperimentVisualizationData("exp-123", {
        tableName: "measurements",
        columns: ["timestamp", "value"],
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual({
      columns: [
        { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
        { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
      ],
      rows: [
        { timestamp: "2024-01-01", value: 123.45 },
        { timestamp: "2024-01-02", value: 234.56 },
      ],
      totalRows: 1000,
      truncated: false,
    });
    expect(result.current.tableInfo).toEqual({
      name: "measurements",
      catalog_name: "catalog1",
      schema_name: "schema1",
      totalRows: 1000,
    });
    expect(result.current.error).toBeNull();
  });

  it("should handle loading state", async () => {
    server.mount(contract.experiments.getExperimentData, {
      body: [createExperimentDataTable({ name: "measurements" })],
      delay: 100,
    });

    const { result } = renderHook(() =>
      useExperimentVisualizationData("exp-123", {
        tableName: "measurements",
      }),
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.tableInfo).toBeUndefined();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("should handle error state", async () => {
    server.mount(contract.experiments.getExperimentData, { status: 500 });

    const { result } = renderHook(() =>
      useExperimentVisualizationData("exp-123", {
        tableName: "measurements",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.tableInfo).toBeUndefined();
    expect(result.current.error).not.toBeNull();
  });

  it("should return undefined table info when body is empty", async () => {
    server.mount(contract.experiments.getExperimentData, { body: [] });

    const { result } = renderHook(() =>
      useExperimentVisualizationData("exp-123", {
        tableName: "measurements",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.tableInfo).toBeUndefined();
  });

  it("should not fetch when tableName is empty", async () => {
    const spy = server.mount(contract.experiments.getExperimentData, {
      body: [createExperimentDataTable()],
    });

    const { result } = renderHook(() =>
      useExperimentVisualizationData("exp-123", {
        tableName: "",
      }),
    );

    // Give it a moment — query should never fire
    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.isLoading).toBe(false);
    expect(spy.called).toBe(false);
  });

  it("should not fetch when enabled is false", async () => {
    const spy = server.mount(contract.experiments.getExperimentData, {
      body: [createExperimentDataTable()],
    });

    const { result } = renderHook(() =>
      useExperimentVisualizationData("exp-123", { tableName: "measurements" }, false),
    );

    // Give it a moment — query should never fire
    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.isLoading).toBe(false);
    expect(spy.called).toBe(false);
  });
});
