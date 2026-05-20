import type { InfiniteData } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
  queryKeys,
  type MeasurementItem,
} from "../measurement-list-cache";
import type { Outbox, SettledItem } from "../outbox";
import { mountOutboxBridge } from "../outbox-to-query-cache-bridge";

// Hand-rolled fake Outbox that only implements subscribeSettled. The
// bridge ignores the rest of the surface, so we don't need a full impl.
function makeFakeOutbox(): { outbox: Outbox; emit(items: SettledItem[]): void } {
  const listeners = new Set<(items: ReadonlyArray<SettledItem>) => void>();
  const outbox: Partial<Outbox> = {
    subscribeSettled(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    outbox: outbox as Outbox,
    emit(items) {
      Array.from(listeners).forEach((l) => l(items));
    },
  };
}

function item(id: string, status: "pending" | "failed" | "successful"): MeasurementItem {
  return {
    id,
    key: id,
    status,
    experimentName: "E",
    protocolName: "P",
    timestamp: "2026-01-01T10:00:00Z",
    questions: [],
    hasComment: false,
  } as MeasurementItem;
}

describe("mountOutboxBridge", () => {
  it("applies a settle burst to the measurement list cache", () => {
    const qc = new QueryClient();
    qc.setQueryData<InfiniteData<MeasurementItem[]>>(queryKeys.list("all"), {
      pages: [[item("r1", "pending")]],
      pageParams: [0],
    });

    const { outbox, emit } = makeFakeOutbox();
    const unmount = mountOutboxBridge({ outbox, queryClient: qc });

    emit([{ id: "r1", status: "successful" }]);

    const data = qc.getQueryData<InfiniteData<MeasurementItem[]>>(queryKeys.list("all"));
    expect(data?.pages[0][0].status).toBe("successful");
    unmount();
  });

  it("unmount stops further patches", () => {
    const qc = new QueryClient();
    qc.setQueryData<InfiniteData<MeasurementItem[]>>(queryKeys.list("all"), {
      pages: [[item("r1", "pending")]],
      pageParams: [0],
    });

    const { outbox, emit } = makeFakeOutbox();
    const unmount = mountOutboxBridge({ outbox, queryClient: qc });
    unmount();

    emit([{ id: "r1", status: "successful" }]);

    const data = qc.getQueryData<InfiniteData<MeasurementItem[]>>(queryKeys.list("all"));
    expect(data?.pages[0][0].status).toBe("pending");
  });

  it("handles a multi-id burst in one dispatch", () => {
    const qc = new QueryClient();
    qc.setQueryData<InfiniteData<MeasurementItem[]>>(queryKeys.list("all"), {
      pages: [[item("a", "pending"), item("b", "pending"), item("c", "pending")]],
      pageParams: [0],
    });

    const { outbox, emit } = makeFakeOutbox();
    mountOutboxBridge({ outbox, queryClient: qc });

    emit([
      { id: "a", status: "successful" },
      { id: "b", status: "failed" },
      { id: "c", status: "successful" },
    ]);

    const data = qc.getQueryData<InfiniteData<MeasurementItem[]>>(queryKeys.list("all"));
    expect(data?.pages[0].map((r) => r.status)).toEqual(["successful", "failed", "successful"]);
  });
});
