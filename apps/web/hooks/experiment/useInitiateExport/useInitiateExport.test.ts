import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";

import { useInitiateExport } from "./useInitiateExport";

describe("useInitiateExport", () => {
  it("sends POST request", async () => {
    const spy = server.mount(contract.experiments.initiateExport, {
      body: { status: "initiated" },
    });

    const { result } = renderHook(() => useInitiateExport());

    act(() => {
      result.current.mutate({
        params: { id: "exp-1" },
        body: { tableName: "raw_data", format: "csv" },
      });
    });

    await waitFor(() => {
      expect(spy.called).toBe(true);
    });
  });

  it("returns mutation result with mutate function", () => {
    const { result } = renderHook(() => useInitiateExport());

    expect(result.current.mutate).toBeDefined();
    expect(typeof result.current.mutate).toBe("function");
  });

  it("forwards the correct request body", async () => {
    const spy = server.mount(contract.experiments.initiateExport, {
      body: { status: "initiated" },
    });

    const { result } = renderHook(() => useInitiateExport());

    act(() => {
      result.current.mutate({
        params: { id: "exp-123" },
        body: { tableName: "raw_data", format: "csv" },
      });
    });

    await waitFor(() => {
      expect(spy.body).toMatchObject({ tableName: "raw_data", format: "csv" });
    });
  });

  it("forwards different table names and formats", async () => {
    const spy = server.mount(contract.experiments.initiateExport, {
      body: { status: "initiated" },
    });

    const { result } = renderHook(() => useInitiateExport());

    act(() => {
      result.current.mutate({
        params: { id: "exp-123" },
        body: { tableName: "device", format: "ndjson" },
      });
    });

    await waitFor(() => {
      expect(spy.body).toMatchObject({ tableName: "device", format: "ndjson" });
    });
  });

  it("calls custom onSuccess callback after mutation succeeds", async () => {
    server.mount(contract.experiments.initiateExport, {
      body: { status: "initiated" },
    });

    const onSuccess = vi.fn();

    const { result } = renderHook(() => useInitiateExport({ onSuccess }));

    act(() => {
      result.current.mutate({
        params: { id: "exp-123" },
        body: { tableName: "raw_data", format: "csv" },
      });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("does not throw when custom onSuccess is not provided", async () => {
    server.mount(contract.experiments.initiateExport, {
      body: { status: "initiated" },
    });

    const { result } = renderHook(() => useInitiateExport());

    act(() => {
      result.current.mutate({
        params: { id: "exp-123" },
        body: { tableName: "raw_data", format: "parquet" },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it("sets error state when the server returns an error", async () => {
    server.mount(contract.experiments.initiateExport, { status: 500 });

    const { result } = renderHook(() => useInitiateExport());

    act(() => {
      result.current.mutate({
        params: { id: "exp-123" },
        body: { tableName: "raw_data", format: "csv" },
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
