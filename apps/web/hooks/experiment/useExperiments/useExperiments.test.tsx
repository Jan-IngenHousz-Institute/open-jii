import { createExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, act, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";

import { useExperiments } from "./useExperiments";

vi.mock("../../useDebounce", () => ({
  useDebounce: vi.fn((v: string) => [v]),
}));

const envelope = (items: unknown[], page = 1, totalPages = 1) => ({
  items,
  page,
  pageSize: 20,
  totalPages,
  totalCount: items.length,
});

describe("useExperiments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.mount(contract.experiments.listExperiments, { body: envelope([]) });
  });

  it("initializes with defaults and fetches experiments", async () => {
    const { result } = renderHook(() => useExperiments({}));
    expect(result.current.status).toBeUndefined();
    expect(result.current.search).toBe("");
    expect(result.current.page).toBe(1);

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
  });

  it("initializes with custom values", () => {
    const { result } = renderHook(() =>
      useExperiments({
        initialStatus: "active",
        initialSearch: "test search",
      }),
    );
    expect(result.current.status).toBe("active");
    expect(result.current.search).toBe("test search");
  });

  it("returns experiment items from API", async () => {
    server.mount(contract.experiments.listExperiments, {
      body: envelope([createExperiment({ id: "exp-1" }), createExperiment({ id: "exp-2" })]),
    });

    const { result } = renderHook(() => useExperiments({}));

    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(2);
    });
  });

  it("sends the current page as a query parameter", async () => {
    const spy = server.mount(contract.experiments.listExperiments, {
      body: envelope([], 1, 3),
    });

    const { result } = renderHook(() => useExperiments({}));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(spy.calls[spy.calls.length - 1]?.query?.page).toBe("1");

    act(() => result.current.setPage(2));

    await waitFor(() => {
      expect(spy.calls[spy.calls.length - 1]?.query?.page).toBe("2");
    });
  });

  it("resets to page 1 when search changes", () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([], 1, 3) });

    const { result } = renderHook(() => useExperiments({}));

    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);

    act(() => result.current.setSearch("wheat"));
    expect(result.current.page).toBe(1);
  });

  it("resets to page 1 when status changes", () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([], 1, 3) });

    const { result } = renderHook(() => useExperiments({}));

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    act(() => result.current.setStatus("active"));
    expect(result.current.page).toBe(1);
  });

  it("clamps the page when the result set shrinks below it", async () => {
    const spy = server.mount(contract.experiments.listExperiments, {
      body: envelope([], 1, 2),
    });

    const { result } = renderHook(() => useExperiments({}));
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    act(() => result.current.setPage(3));

    await waitFor(() => {
      expect(result.current.page).toBe(2);
    });
    expect(spy.calls[spy.calls.length - 1]?.query?.page).toBe("2");
  });

  it("clamps the page to 1 when the result set shrinks to a single page", async () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([]) });

    const { result } = renderHook(() => useExperiments({}));
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    act(() => result.current.setPage(2));

    await waitFor(() => {
      expect(result.current.page).toBe(1);
    });
  });

  it("requests scope=related and status=archived for the archive view", async () => {
    const spy = server.mount(contract.experiments.listExperiments, {
      body: envelope([]),
    });

    const { result } = renderHook(() => useExperiments({ archived: true }));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    const lastCall = spy.calls[spy.calls.length - 1];
    expect(lastCall.query.scope).toBe("related");
    expect(lastCall.query.status).toBe("archived");
  });

  it("omits scope and sends no legacy filter param otherwise", async () => {
    const spy = server.mount(contract.experiments.listExperiments, {
      body: envelope([]),
    });

    const { result } = renderHook(() => useExperiments({}));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    const lastCall = spy.calls[spy.calls.length - 1];
    expect(lastCall.query.scope).toBeUndefined();
    expect(lastCall.query.filter).toBeUndefined();
  });

  it("handles API error gracefully", async () => {
    server.mount(contract.experiments.listExperiments, { status: 500 });

    const { result } = renderHook(() => useExperiments({}));

    await waitFor(() => {
      expect(result.current.data).toBeUndefined();
    });

    expect(result.current.search).toBe("");
    expect(result.current.page).toBe(1);
  });
});
