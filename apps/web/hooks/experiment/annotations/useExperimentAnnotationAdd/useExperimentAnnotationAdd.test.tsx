import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { useExperimentAnnotationAdd } from "./useExperimentAnnotationAdd";

describe("useExperimentAnnotationAdd", () => {
  it("sends POST request", async () => {
    const spy = server.mount(orpcContract.experiments.addAnnotation, {
      body: { rowsAffected: 1 },
    });

    const { result } = renderHook(() => useExperimentAnnotationAdd());

    act(() => {
      result.current.mutate({
        id: "exp-1",
        tableName: "measurements",
        rowId: "row-1",
        annotation: { type: "comment", content: { type: "comment", text: "Test note" } },
      });
    });

    await waitFor(() => expect(spy.called).toBe(true));
  });

  it("sends correct params and body", async () => {
    const spy = server.mount(orpcContract.experiments.addAnnotation, {
      body: { rowsAffected: 1 },
    });

    const { result } = renderHook(() => useExperimentAnnotationAdd());

    act(() => {
      result.current.mutate({
        id: "exp-42",
        tableName: "results",
        rowId: "row-99",
        annotation: { type: "flag", content: { type: "flag", flagType: "outlier" } },
      });
    });

    await waitFor(() => {
      expect(spy.params.id).toBe("exp-42");
      expect(spy.body).toMatchObject({
        tableName: "results",
        rowId: "row-99",
        annotation: { type: "flag", content: { type: "flag", flagType: "outlier" } },
      });
    });
  });

  it("handles error", async () => {
    server.mount(orpcContract.experiments.addAnnotation, { status: 400 });

    const { result } = renderHook(() => useExperimentAnnotationAdd());

    act(() => {
      result.current.mutate({
        id: "exp-1",
        tableName: "measurements",
        rowId: "row-1",
        annotation: { type: "comment", content: { type: "comment", text: "Test" } },
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
