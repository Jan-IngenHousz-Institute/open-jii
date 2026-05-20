import { createPahoSessionFactory } from "~/features/connection/services/mqtt/mqtt-paho-session";
import { createTransport } from "~/features/connection/services/mqtt/mqtt-transport";
import type { Transport } from "~/features/connection/services/mqtt/mqtt-transport";
import { createOutbox } from "~/features/recent-measurements/services/outbox";
import type { Outbox } from "~/features/recent-measurements/services/outbox";

// Composition root for the upload pipeline. One Transport wired into one
// Outbox, lazily created on first call. This is the only place that picks
// the concrete paho-mqtt adapter; everything else takes Transport /
// Outbox as injected dependencies (tests substitute fakes).

let transport: Transport | null = null;
let outbox: Outbox | null = null;

export function getTransport(): Transport {
  transport = transport ?? createTransport({ pahoSessionFactory: createPahoSessionFactory() });
  return transport;
}

export function getOutbox(): Outbox {
  outbox = outbox ?? createOutbox({ transport: getTransport() });
  return outbox;
}
