import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useExperimentMetadata } from "./useExperimentMetadata";

describe("useExperimentMetadata", () => {
  it("returns metadata for an experiment", async () => {
    server.mount(contract.experiments.listExperimentMetadata, {
      body: [
        {
          metadataId: "meta-1",
          experimentId: "exp-123",
          metadata: { location: "Lab A" },
          createdBy: "user-1",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-02T00:00:00.000Z",
        },
      ],
    });

    const { result } = renderHook(() => useExperimentMetadata("exp-123"));

    await waitFor(() => {
      expect(result.current.data?.body).toHaveLength(1);
      expect(result.current.data?.body[0].metadataId).toBe("meta-1");
      expect(result.current.data?.body[0].metadata).toEqual({ location: "Lab A" });
    });
  });

  it("returns empty array when no metadata exists", async () => {
    server.mount(contract.experiments.listExperimentMetadata, { body: [] });

    const { result } = renderHook(() => useExperimentMetadata("exp-123"));

    await waitFor(() => {
      expect(result.current.data?.body).toEqual([]);
    });
  });

  it("handles loading state", () => {
    server.mount(contract.experiments.listExperimentMetadata, {
      body: [],
      delay: 999_999,
    });

    const { result } = renderHook(() => useExperimentMetadata("exp-123"));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("handles error state", async () => {
    server.mount(contract.experiments.listExperimentMetadata, { status: 500 });

    const { result } = renderHook(() => useExperimentMetadata("exp-123"));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });
});
