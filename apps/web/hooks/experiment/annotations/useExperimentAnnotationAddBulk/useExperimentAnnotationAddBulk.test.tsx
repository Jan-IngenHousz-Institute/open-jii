import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useExperimentAnnotationAddBulk } from "./useExperimentAnnotationAddBulk";

describe("useExperimentAnnotationAddBulk", () => {
  it("sends POST request via MSW", async () => {
    const spy = server.mount(contract.experiments.addAnnotationsBulk, {
      body: { rowsAffected: 3 },
    });

    const { result } = renderHook(() => useExperimentAnnotationAddBulk());

    act(() => {
      result.current.mutate({
        params: { id: "exp-1" },
        body: {
          tableName: "measurements",
          rowIds: ["row-1", "row-2", "row-3"],
          annotation: { type: "comment", content: { type: "comment", text: "Bulk note" } },
        },
      });
    });

    await waitFor(() => expect(spy.called).toBe(true));
  });

  it("sends correct params and body", async () => {
    const spy = server.mount(contract.experiments.addAnnotationsBulk, {
      body: { rowsAffected: 2 },
    });

    const { result } = renderHook(() => useExperimentAnnotationAddBulk());

    act(() => {
      result.current.mutate({
        params: { id: "exp-42" },
        body: {
          tableName: "results",
          rowIds: ["row-10", "row-20"],
          annotation: { type: "flag", content: { type: "flag", flagType: "needs_review" } },
        },
      });
    });

    await waitFor(() => {
      expect(spy.params.id).toBe("exp-42");
      expect(spy.body).toMatchObject({
        tableName: "results",
        rowIds: ["row-10", "row-20"],
        annotation: { type: "flag", content: { type: "flag", flagType: "needs_review" } },
      });
    });
  });

  it("handles error", async () => {
    server.mount(contract.experiments.addAnnotationsBulk, { status: 400 });

    const { result } = renderHook(() => useExperimentAnnotationAddBulk());

    act(() => {
      result.current.mutate({
        params: { id: "exp-1" },
        body: {
          tableName: "measurements",
          rowIds: ["row-1"],
          annotation: { type: "comment", content: { type: "comment", text: "Test" } },
        },
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
