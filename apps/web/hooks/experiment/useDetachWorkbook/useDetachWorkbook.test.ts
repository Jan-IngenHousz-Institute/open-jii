import { createExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import { useDetachWorkbook } from "./useDetachWorkbook";

const experimentId = "11111111-1111-1111-1111-111111111111";

describe("useDetachWorkbook", () => {
  it("calls detach endpoint and returns updated experiment", async () => {
    const updatedExperiment = createExperiment({
      id: experimentId,
      workbookId: null,
      workbookVersionId: "33333333-3333-3333-3333-333333333333",
    });
    const spy = server.mount(contract.experiments.detachWorkbook, {
      body: updatedExperiment,
    });

    const { result } = renderHook(() => useDetachWorkbook());

    act(() => {
      result.current.mutate({ params: { id: experimentId } });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(spy.called).toBe(true);
  });

  it("handles error state", async () => {
    server.mount(contract.experiments.detachWorkbook, { status: 500 });

    const { result } = renderHook(() => useDetachWorkbook());

    act(() => {
      result.current.mutate({ params: { id: experimentId } });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
