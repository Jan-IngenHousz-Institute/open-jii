/**
 * useExperimentAccess hook test — MSW-based.
 *
 * The real hook calls `tsr.experiments.getExperimentAccess.useQuery` which
 * issues `GET /api/v1/experiments/:id/access`. MSW intercepts that request.
 */
import { createExperimentAccess } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api";

import { useExperimentAccess } from "./useExperimentAccess";

describe("useExperimentAccess", () => {
  it("returns experiment access data from MSW", async () => {
    server.mount(contract.experiments.getExperimentAccess, {
      body: createExperimentAccess({ isAdmin: true }),
    });

    const { result } = renderHook(() => useExperimentAccess("exp-123"));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    // Default MSW handler returns hasAccess: true, isAdmin: true
    expect(result.current.data?.body).toMatchObject({
      hasAccess: true,
      isAdmin: true,
    });
    expect(result.current.isLoading).toBe(false);
  });

  it("handles 404 error", async () => {
    server.mount(contract.experiments.getExperimentAccess, { status: 404 });

    const { result } = renderHook(() => useExperimentAccess("bad-id"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // On 404, the retry function from shouldRetryQuery returns false
    expect(result.current.data?.body).toBeUndefined();
  });
});
