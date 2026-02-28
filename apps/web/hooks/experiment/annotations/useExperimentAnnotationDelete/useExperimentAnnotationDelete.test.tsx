import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useExperimentAnnotationDelete } from "./useExperimentAnnotationDelete";

describe("useExperimentAnnotationDelete", () => {
  it("sends DELETE request", async () => {
    const spy = server.mount(contract.experiments.deleteAnnotation, {
      body: { rowsAffected: 1 },
    });

    const { result } = renderHook(() => useExperimentAnnotationDelete());

    act(() => {
      result.current.mutate({
        params: { id: "exp-1", annotationId: "ann-1" },
      });
    });

    await waitFor(() => expect(spy.called).toBe(true));
  });

  it("sends correct params", async () => {
    const spy = server.mount(contract.experiments.deleteAnnotation, {
      body: { rowsAffected: 1 },
    });

    const { result } = renderHook(() => useExperimentAnnotationDelete());

    act(() => {
      result.current.mutate({
        params: { id: "exp-42", annotationId: "ann-99" },
      });
    });

    await waitFor(() => {
      expect(spy.params.id).toBe("exp-42");
      expect(spy.params.annotationId).toBe("ann-99");
    });
  });

  it("handles error", async () => {
    server.mount(contract.experiments.deleteAnnotation, { status: 404 });

    const { result } = renderHook(() => useExperimentAnnotationDelete());

    act(() => {
      result.current.mutate({
        params: { id: "exp-1", annotationId: "ann-1" },
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
