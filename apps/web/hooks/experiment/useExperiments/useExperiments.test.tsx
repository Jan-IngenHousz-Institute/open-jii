/**
 * useExperiments hook test — MSW-based.
 *
 * The real hook calls `tsr.experiments.listExperiments.useQuery`, which
 * issues a `GET /api/v1/experiments`.  MSW intercepts that request and
 * returns controlled data, so we test the hook's *observable behaviour*
 * (filter / search / status / URL sync) without touching internal wiring.
 *
 * `useDebounce` is still mocked — it's a timing utility with no HTTP,
 * and letting it tick naturally would make every test wait 300ms.
 *
 * `next/navigation` is still mocked — it's framework-level, not HTTP.
 */
import { createExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, act, waitFor } from "@/test/test-utils";
import { useSearchParams, usePathname } from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api";

import { useExperiments } from "./useExperiments";

/* ─── Non-HTTP mocks ─────────────────────────────────────────── */

vi.mock("../../useDebounce", () => ({
  useDebounce: vi.fn((v: string) => [v]),
}));

const mockSearchParams = {
  get: vi.fn().mockReturnValue(null),
  toString: vi.fn().mockReturnValue(""),
};

/* ─── Tests ──────────────────────────────────────────────────── */

describe("useExperiments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSearchParams).mockReturnValue(mockSearchParams as never);
    vi.mocked(usePathname).mockReturnValue("/platform/experiments");
    mockSearchParams.get.mockReturnValue(null);
    mockSearchParams.toString.mockReturnValue("");
  });

  /* Initialization */

  it("initializes with defaults and fetches experiments", async () => {
    server.mount(contract.experiments.listExperiments, { body: [] });

    const { result } = renderHook(() => useExperiments({}));
    expect(result.current.filter).toBe("member");
    expect(result.current.status).toBeUndefined();
    expect(result.current.search).toBe("");

    // Default MSW handler returns []
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
  });

  it("initializes with custom values", () => {
    const { result } = renderHook(() =>
      useExperiments({
        initialFilter: "all",
        initialStatus: "active",
        initialSearch: "test search",
      }),
    );
    expect(result.current.filter).toBe("all");
    expect(result.current.status).toBe("active");
    expect(result.current.search).toBe("test search");
  });

  /* Data */

  it("returns experiment data from API", async () => {
    server.mount(contract.experiments.listExperiments, {
      body: [createExperiment({ id: "exp-1" }), createExperiment({ id: "exp-2" })],
    });

    const { result } = renderHook(() => useExperiments({}));

    await waitFor(() => {
      expect(result.current.data?.status).toBe(200);
    });
    expect(result.current.data?.body).toHaveLength(2);
  });

  /* State updates */

  it("updates filter and URL", () => {
    const { result, router } = renderHook(() => useExperiments({}));

    act(() => result.current.setFilter("all"));
    expect(result.current.filter).toBe("all");
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(router.push).toHaveBeenCalledWith("/platform/experiments?filter=all", {
      scroll: false,
    });

    act(() => result.current.setFilter("member"));
    expect(result.current.filter).toBe("member");
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(router.push).toHaveBeenCalledWith("/platform/experiments", {
      scroll: false,
    });
  });

  it("updates search state", () => {
    const { result } = renderHook(() => useExperiments({}));
    act(() => result.current.setSearch("new search"));
    expect(result.current.search).toBe("new search");
  });

  /* URL initialization */

  it("reads filter from URL params", () => {
    mockSearchParams.get.mockReturnValue("all");
    const { result } = renderHook(() => useExperiments({}));
    expect(result.current.filter).toBe("all");
  });

  it("cleans up invalid URL filter", () => {
    mockSearchParams.get.mockReturnValue("invalid");
    mockSearchParams.toString.mockReturnValue("filter=invalid");
    const { router } = renderHook(() => useExperiments({}));
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(router.push).toHaveBeenCalledWith("/platform/experiments", {
      scroll: false,
    });
  });

  it("does not clean up valid 'all' filter in URL", () => {
    mockSearchParams.get.mockReturnValue("all");
    mockSearchParams.toString.mockReturnValue("filter=all");
    const { router } = renderHook(() => useExperiments({}));
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(router.push).not.toHaveBeenCalled();
  });

  /* Error handling */

  it("handles API error gracefully", async () => {
    server.mount(contract.experiments.listExperiments, { status: 500 });

    // The hook should not throw even when the API returns 500.
    // ts-rest puts non-2xx responses in the query error state,
    // so `data` remains undefined — the important thing is no crash.
    const { result } = renderHook(() => useExperiments({}));

    await waitFor(() => {
      expect(result.current.data).toBeUndefined();
    });

    // Hook still exposes filter / search controls (not broken)
    expect(result.current.filter).toBe("member");
    expect(result.current.search).toBe("");
  });
});
