import type { QueryClient } from "@tanstack/react-query";

import { applySettledPatchBatch } from "./measurement-list-cache";
import type { Outbox } from "./outbox";

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

export function mountOutboxBridge({
  outbox,
  queryClient,
}: MountOutboxBridgeOptions): () => void {
  return outbox.subscribeSettled((items) => {
    applySettledPatchBatch(queryClient, items);
  });
}
