import { createExperimentAccess } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { useExperimentAccess } from "./useExperimentAccess";

describe("useExperimentAccess", () => {
  it("returns experiment access data", async () => {
    server.mount(orpcContract.experiments.getExperimentAccess, {
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

  it("handles 404 error", async () => {
    server.mount(orpcContract.experiments.getExperimentAccess, { status: 404 });

    const { result } = renderHook(() => useExperimentAccess("bad-id"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // On 404, the retry function from shouldRetryQuery returns false
    expect(result.current.data).toBeUndefined();
  });
});
