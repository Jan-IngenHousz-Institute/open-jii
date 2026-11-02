import { API_URL } from "@/test/msw/mount";
import type { SpyCall } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { http, HttpResponse } from "msw";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import { useExperimentDistinctValues } from "./useExperimentDistinctValues";

describe("useExperimentDistinctValues", () => {
  it("returns the values array from the response body", async () => {
    server.mount(contract.experiments.getDistinctColumnValues, {
      body: { values: ["alpha", "beta", "gamma"], truncated: false },
    });

    const { result } = renderHook(() =>
      useExperimentDistinctValues({
        experimentId: "exp-1",
        tableName: "raw_data",
        column: "site",
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.values).toEqual(["alpha", "beta", "gamma"]);
    expect(result.current.truncated).toBe(false);
  });

  it("exposes the truncated flag from the server", async () => {
    server.mount(contract.experiments.getDistinctColumnValues, {
      body: { values: [1, 2, 3], truncated: true },
    });

    const { result } = renderHook(() =>
      useExperimentDistinctValues({
        experimentId: "exp-1",
        tableName: "raw_data",
        column: "value",
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.truncated).toBe(true);
  });

  it("advances by the received values when a warehouse byte cap shortens a page", async () => {
    const spy = server.mount(contract.experiments.getDistinctColumnValues, {
      body: ({ query }: SpyCall) =>
        Number(query.offset) === 0
          ? { values: ["A", "B"], truncated: true }
          : { values: ["C"], truncated: false },
    });
    const { result } = renderHook(() =>
      useExperimentDistinctValues({
        experimentId: "exp-1",
        tableName: "raw_data",
        column: "device",
        allPages: true,
      }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.values).toEqual(["A", "B", "C"]);
    expect(spy.calls.map((call) => call.query.offset)).toEqual(["0", "2"]);
  });

  it("shows the first page while the remaining device options load", async () => {
    let release: (() => void) | undefined;
    let nextRequested = false;
    const nextPage = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${API_URL}/api/v1/experiments/:id/data/distinct`, async ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get("offset"));
        if (offset === 0) return HttpResponse.json({ values: ["A"], truncated: true });
        nextRequested = true;
        await nextPage;
        return HttpResponse.json({ values: ["B"], truncated: false });
      }),
    );
    const { result } = renderHook(() =>
      useExperimentDistinctValues({
        experimentId: "exp-1",
        tableName: "raw_data",
        column: "device",
        allPages: true,
      }),
    );
    try {
      await waitFor(() => expect(nextRequested).toBe(true));
      expect(result.current.values).toEqual(["A"]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.truncated).toBe(false);
    } finally {
      release?.();
    }
    await waitFor(() => expect(result.current.values).toEqual(["A", "B"]));
  });

  it("falls back to an empty array and not truncated when data is undefined", () => {
    server.mount(contract.experiments.getDistinctColumnValues, {
      body: { values: [], truncated: false },
    });

    const { result } = renderHook(() =>
      useExperimentDistinctValues({
        experimentId: "exp-1",
        tableName: "raw_data",
        column: "site",
        enabled: false,
      }),
    );

    expect(result.current.values).toEqual([]);
    expect(result.current.truncated).toBe(false);
  });

  it("does not fetch when the column is empty (disabled by guard)", async () => {
    const spy = server.mount(contract.experiments.getDistinctColumnValues, {
      body: { values: [], truncated: false },
    });

    renderHook(() =>
      useExperimentDistinctValues({
        experimentId: "exp-1",
        tableName: "raw_data",
        column: "",
      }),
    );

    // Brief microtask wait so any synchronous fetch would have triggered.
    await Promise.resolve();
    expect(spy.called).toBe(false);
  });

  it("surfaces errors on result.current.error", async () => {
    server.mount(contract.experiments.getDistinctColumnValues, { status: 500 });

    const { result } = renderHook(() =>
      useExperimentDistinctValues({
        experimentId: "exp-1",
        tableName: "raw_data",
        column: "site",
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.values).toEqual([]);
  });

  it("passes column/tableName/limit through to the request", async () => {
    const spy = server.mount(contract.experiments.getDistinctColumnValues, {
      body: { values: [], truncated: false },
    });

    const { result } = renderHook(() =>
      useExperimentDistinctValues({
        experimentId: "exp-1",
        tableName: "raw_data",
        column: "site",
        limit: 25,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const lastCall = spy.calls[spy.calls.length - 1];
    expect(lastCall.query.column).toBe("site");
    expect(lastCall.query.tableName).toBe("raw_data");
    expect(lastCall.query.limit).toBe("25");
  });
});
