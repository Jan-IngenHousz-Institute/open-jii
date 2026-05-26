import { Throttler } from "@tanstack/pacer";
import type { QueryClient } from "@tanstack/react-query";

import { applySettledPatchBatch } from "./measurement-list-cache";
import type { Outbox, SettledItem } from "./outbox";

// Wires the Outbox's batched settled stream to the measurement list
// cache. Always-on, mounted once at the app root — every consumer (Recent
// tab, Home tab preview) sees the same fresh cache without each screen
// running its own bridge. Cost per burst is bounded by the Outbox
// batcher: one dispatch per microtask, one setQueryData per affected
// query, zero DB reads.
//
// Returned unmount fn lets a test or app teardown release the
// subscription cleanly.
export interface MountOutboxBridgeOptions {
  outbox: Outbox;
  queryClient: QueryClient;
}

// Settles are coalesced before touching the query cache: the Outbox can drain
// ~5–8 acks/sec, but the UI only needs to reflect them a couple times/sec.
// Buffering by id (last status wins) collapses a window of settles into ONE
// applySettledPatchBatch. A TanStack Pacer throttler runs the flush on the
// leading edge (instant for a lone settle) and the trailing edge (coalesced
// bursts), so paho's PUBACK parsing isn't starved by render churn on the
// shared JS thread. See OJD-1470.
const FLUSH_INTERVAL_MS = 2000;

export function mountOutboxBridge({ outbox, queryClient }: MountOutboxBridgeOptions): () => void {
  const buffer = new Map<string, SettledItem>();

  const flush = () => {
    if (buffer.size === 0) return;
    const items = Array.from(buffer.values());
    buffer.clear();
    applySettledPatchBatch(queryClient, items);
  };

  // leading+trailing: a lone settle patches immediately; bursts collapse into
  // one trailing flush per window instead of one re-render per ack.
  const throttler = new Throttler(flush, {
    wait: FLUSH_INTERVAL_MS,
    leading: true,
    trailing: true,
  });

  const unsubscribe = outbox.subscribeSettled((items) => {
    for (const item of items) buffer.set(item.id, item);
    throttler.maybeExecute();
  });

  return () => {
    unsubscribe();
    throttler.cancel(); // drop any scheduled trailing flush
    flush(); // drain whatever is still buffered so teardown drops nothing
  };
}
