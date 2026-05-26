import { createPahoSessionFactory } from "~/features/connection/services/mqtt/mqtt-paho-session";
import { createTransport } from "~/features/connection/services/mqtt/mqtt-transport";
import type { Transport } from "~/features/connection/services/mqtt/mqtt-transport";
import { createOutbox } from "~/features/recent-measurements/services/outbox";
import type { Outbox } from "~/features/recent-measurements/services/outbox";

// Composition root for the upload pipeline. One Transport wired into one
// Outbox, lazily created on first call. This is the only place that picks the
// concrete paho-mqtt adapter; everything else takes Transport / Outbox as
// injected dependencies (tests substitute fakes).
//
// The singletons live on `globalThis`, NOT module-level `let`s, on purpose.
// React Native Fast Refresh re-evaluates this module (and every module it
// imports) on each edit. With `let` bindings — which reset to null on
// re-eval — the next getOutbox()/getTransport() built a *fresh* pipeline
// while the previous one kept running: its MQTT session, 30s idle timer,
// network/foreground listeners, and rehydrate-on-construct all survive inside
// closures the GC can't reach. N reloads => N live Outboxes, each draining the
// shared `measurements` SQLite queue and re-publishing every pending row.
// That is exactly the bug we saw: N simultaneous "idle — closing session"
// logs and 4–5x duplicate PUBACKs once a few reloads had stacked up. A value
// parked on globalThis survives module re-eval, so callers always get the one
// live pipeline.
//
// Production has no Fast Refresh, so the multiplication cannot happen there
// today. But parking on globalThis *and* tearing the graph down on hot
// dispose makes duplication structurally impossible regardless of how (or how
// often) this module is re-evaluated — cheap insurance against a future move
// of these getters into a remountable provider or a JS-context reload.

interface UploadGraph {
  transport: Transport | null;
  outbox: Outbox | null;
}

const GRAPH_KEY = "__openJiiUploadGraph__" as const;

type GlobalWithGraph = typeof globalThis & { [GRAPH_KEY]?: UploadGraph };

function graph(): UploadGraph {
  const g = globalThis as GlobalWithGraph;
  return (g[GRAPH_KEY] ??= { transport: null, outbox: null });
}

export function getTransport(): Transport {
  const g = graph();
  g.transport ??= createTransport({ pahoSessionFactory: createPahoSessionFactory() });
  return g.transport;
}

export function getOutbox(): Outbox {
  const g = graph();
  g.outbox ??= createOutbox({ transport: getTransport() });
  return g.outbox;
}

// Dev-only: when Metro hot-replaces this module, tear the live pipeline down
// so the next get*() rebuilds on the new code instead of layering a second
// pipeline beside the old one. `module.hot` is injected by Metro in dev and is
// undefined in release builds, so this whole block is a no-op in production.
declare const module: { hot?: { dispose: (callback: () => void) => void } } | undefined;

// The `typeof` guard (rather than `module?.hot`) is deliberate: under ESM test
// runners the `module` identifier can be entirely undeclared, where reading it
// for an optional chain would itself throw a ReferenceError.
if (typeof module !== "undefined") {
  module.hot?.dispose(() => {
    const g = graph();
    g.outbox?.destroy();
    g.transport?.destroy();
    g.outbox = null;
    g.transport = null;
  });
}
