import { orpc } from "@/lib/orpc";
import { createRecentlyOpenedResource } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { useQuery } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import { toast } from "@repo/ui/hooks/use-toast";

import { useRecordVisit } from "./useRecordVisit";

describe("useRecordVisit", () => {
  it("records a visit to the resource once enabled", async () => {
    const spy = server.mount(contract.visits.recordVisit, { status: 204 });

    const { rerender } = renderHook(
      ({ enabled }) => useRecordVisit("protocol", "protocol-1", enabled),
      { initialProps: { enabled: false } },
    );
    expect(spy.called).toBe(false);

    rerender({ enabled: true });

    await waitFor(() => expect(spy.called).toBe(true));
    expect(spy.body).toEqual({ resourceType: "protocol", resourceId: "protocol-1" });
  });

  it("stays silent when recording fails", async () => {
    const spy = server.mount(contract.visits.recordVisit, { status: 500 });

    renderHook(() => useRecordVisit("experiment", "exp-1", true));

    await waitFor(() => expect(spy.called).toBe(true));
    expect(toast).not.toHaveBeenCalled();
  });

  it("refreshes Recently opened after recording a visit", async () => {
    server.mount(contract.visits.listRecentlyOpened, { body: { items: [], types: [] } });
    server.mount(contract.visits.recordVisit, { status: 204 });
    const { result, rerender } = renderHook(
      ({ enabled }) => {
        useRecordVisit("macro", "macro-1", enabled);
        return useQuery(orpc.visits.listRecentlyOpened.queryOptions({ input: {} }));
      },
      { initialProps: { enabled: false } },
    );
    await waitFor(() => expect(result.current.data?.items).toEqual([]));

    server.mount(contract.visits.listRecentlyOpened, {
      body: {
        items: [createRecentlyOpenedResource({ type: "macro", id: "macro-1", language: "python" })],
        types: ["macro"],
      },
    });
    rerender({ enabled: true });

    await waitFor(() => expect(result.current.data?.items[0]?.id).toBe("macro-1"));
  });
});
