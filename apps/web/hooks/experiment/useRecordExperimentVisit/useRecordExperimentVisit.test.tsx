import { orpc } from "@/lib/orpc";
import { createRecentlyOpenedExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { useQuery } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { useRecordExperimentVisit } from "./useRecordExperimentVisit";

describe("useRecordExperimentVisit", () => {
  it("records a visit to the experiment once enabled", async () => {
    const spy = server.mount(contract.visits.recordExperimentVisit, { status: 204 });

    const { rerender } = renderHook(({ enabled }) => useRecordExperimentVisit("exp-1", enabled), {
      initialProps: { enabled: false },
    });
    expect(spy.called).toBe(false);

    rerender({ enabled: true });

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.params).toEqual({ id: "exp-1" });
  });

  it("stays silent when recording fails", async () => {
    const spy = server.mount(contract.visits.recordExperimentVisit, { status: 500 });

    renderHook(() => useRecordExperimentVisit("exp-1", true));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(toast).not.toHaveBeenCalled();
  });

  it("refreshes home from fallback to actual history after recording a visit", async () => {
    server.mount(contract.experiments.listHomeExperiments, {
      body: { source: "related", experiments: [] },
    });
    server.mount(contract.visits.recordExperimentVisit, { status: 204 });
    const { result, rerender } = renderHook(
      ({ enabled }) => {
        useRecordExperimentVisit("exp-1", enabled);
        return useQuery(orpc.experiments.listHomeExperiments.queryOptions({ input: { limit: 3 } }));
      },
      { initialProps: { enabled: false } },
    );
    await waitFor(() => expect(result.current.data?.source).toBe("related"));
    server.mount(contract.experiments.listHomeExperiments, {
      body: {
        source: "recently-opened",
        experiments: [createRecentlyOpenedExperiment({ id: "exp-1" })],
      },
    });
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.data?.source).toBe("recently-opened"));
    expect(result.current.data?.experiments[0].id).toBe("exp-1");
  });
});
