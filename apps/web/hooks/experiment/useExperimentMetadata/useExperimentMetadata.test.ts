import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { useExperimentMetadata } from "./useExperimentMetadata";

const metadataPayload = {
  name: "Plates",
  columns: [{ id: "col-1", name: "plate_id", type: "string" as const }],
  rows: [],
  identifierColumnId: "col-1",
  experimentQuestionId: "q-1",
};

describe("useExperimentMetadata", () => {
  it("returns metadata for an experiment", async () => {
    server.mount(orpcContract.experiments.listExperimentMetadata, {
      body: [
        {
          metadataId: "00000000-0000-0000-0000-000000000001",
          experimentId: "00000000-0000-0000-0000-0000000000aa",
          metadata: metadataPayload,
          createdBy: "00000000-0000-0000-0000-0000000000bb",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-02T00:00:00.000Z",
        },
      ],
    });

    const { result } = renderHook(() => useExperimentMetadata("exp-123"));

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].metadataId).toBe("00000000-0000-0000-0000-000000000001");
      expect(result.current.data?.[0].metadata).toEqual(metadataPayload);
    });
  });

  it("returns empty array when no metadata exists", async () => {
    server.mount(orpcContract.experiments.listExperimentMetadata, { body: [] });

    const { result } = renderHook(() => useExperimentMetadata("exp-123"));

    await waitFor(() => {
      expect(result.current.data).toEqual([]);
    });
  });

  it("handles loading state", () => {
    server.mount(orpcContract.experiments.listExperimentMetadata, {
      body: [],
      delay: 999_999,
    });

    const { result } = renderHook(() => useExperimentMetadata("exp-123"));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("handles error state", async () => {
    server.mount(orpcContract.experiments.listExperimentMetadata, { status: 500 });

    const { result } = renderHook(() => useExperimentMetadata("exp-123"));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });
});
