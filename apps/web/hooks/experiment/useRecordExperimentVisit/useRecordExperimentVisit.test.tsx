import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { useRecordExperimentVisit } from "./useRecordExperimentVisit";

describe("useRecordExperimentVisit", () => {
  it("records a visit to the experiment once enabled", async () => {
    const spy = server.mount(contract.visits.recordVisit, { status: 204 });

    const { rerender } = renderHook(({ enabled }) => useRecordExperimentVisit("exp-1", enabled), {
      initialProps: { enabled: false },
    });
    expect(spy.called).toBe(false);

    rerender({ enabled: true });

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toEqual({ resourceType: "experiment", resourceId: "exp-1" });
  });

  it("stays silent when recording fails", async () => {
    const spy = server.mount(contract.visits.recordVisit, { status: 500 });

    renderHook(() => useRecordExperimentVisit("exp-1", true));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(toast).not.toHaveBeenCalled();
  });
});
