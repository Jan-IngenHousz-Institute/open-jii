import { createExperimentAccess } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { useExperimentAccess } from "./useExperimentAccess";

describe("useExperimentAccess", () => {
  // `vi.clearAllMocks()` in the global teardown keeps per-test return values, so a
  // test that hands `useSession` a pending session has to put the default back.
  afterEach(() => {
    vi.mocked(useSession).mockReturnValue({ data: null, isPending: false } as ReturnType<
      typeof useSession
    >);
  });

  it("returns experiment access data", async () => {
    server.mount(contract.experiments.getExperimentAccess, {
      body: createExperimentAccess({ isAdmin: true }),
    });

    const { result } = renderHook(() => useExperimentAccess("exp-123"));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toMatchObject({
      hasAccess: true,
      isAdmin: true,
    });
    expect(result.current.isLoading).toBe(false);
  });

  it("reports loading, not an empty answer, while the session is still resolving", () => {
    vi.mocked(useSession).mockReturnValue({ data: null, isPending: true } as ReturnType<
      typeof useSession
    >);
    server.mount(contract.experiments.getExperimentAccess, {
      body: createExperimentAccess({ isAdmin: true }),
    });

    const { result } = renderHook(() => useExperimentAccess("exp-123"));

    // The query is disabled until the session lands, and react-query's own
    // `isLoading` is false for a disabled query — consumers reading it would take
    // that as "answered, no experiment" and flash their not-found branch.
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it("handles 404 error", async () => {
    server.mount(contract.experiments.getExperimentAccess, { status: 404 });

    const { result } = renderHook(() => useExperimentAccess("bad-id"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // On 404, the retry function from shouldRetryQuery returns false
    expect(result.current.data).toBeUndefined();
  });
});
