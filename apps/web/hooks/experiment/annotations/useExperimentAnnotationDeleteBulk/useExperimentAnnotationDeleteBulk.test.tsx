import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { useExperimentAnnotationDeleteBulk } from "./useExperimentAnnotationDeleteBulk";

describe("useExperimentAnnotationDeleteBulk", () => {
  it("sends POST request", async () => {
    const spy = server.mount(orpcContract.experiments.deleteAnnotationsBulk, {
      body: { rowsAffected: 2 },
    });

    const { result } = renderHook(() => useExperimentAnnotationDeleteBulk());

    act(() => {
      result.current.mutate({
        id: "exp-1",
        tableName: "measurements",
        rowIds: ["row-1", "row-2"],
        type: "comment",
      });
    });

    await waitFor(() => expect(spy.called).toBe(true));
  });

  it("sends correct params and body", async () => {
    const spy = server.mount(orpcContract.experiments.deleteAnnotationsBulk, {
      body: { rowsAffected: 3 },
    });

    const { result } = renderHook(() => useExperimentAnnotationDeleteBulk());

    act(() => {
      result.current.mutate({
        id: "exp-42",
        tableName: "results",
        rowIds: ["row-10", "row-20", "row-30"],
        type: "flag",
      });
    });

    await waitFor(() => {
      expect(spy.params.id).toBe("exp-42");
      expect(spy.body).toMatchObject({
        tableName: "results",
        rowIds: ["row-10", "row-20", "row-30"],
        type: "flag",
      });
    });
  });

  it("handles error", async () => {
    server.mount(orpcContract.experiments.deleteAnnotationsBulk, { status: 404 });

    const { result } = renderHook(() => useExperimentAnnotationDeleteBulk());

    act(() => {
      result.current.mutate({
        id: "exp-1",
        tableName: "measurements",
        rowIds: ["row-1"],
        type: "comment",
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
