# Mobile — Domain Context

Living glossary for the Field Companion (mobile app). Terms used in code, tests, PRs, and ADRs must match this file. When code introduces a concept that isn't here, add it here first.

---

## Core entities

### Measurement

A single sample produced by a MultispeQ device for a given experiment + protocol, optionally accompanied by user-answered questions, macro output, and annotations. Persisted locally in SQLite (`shared/db/measurements-storage.ts`) before any cloud upload is attempted.

### Status

The lifecycle of a stored Measurement on-device:

- **pending** — saved locally, not yet acknowledged by the cloud. May be sitting in the Outbox, paused offline, or waiting for boot rehydration.
- **successful** — broker (AWS IoT) has acknowledged receipt (QoS 1 PUBACK).
- **failed** — Outbox has exhausted its retry policy. Requires user action (or next foreground rehydrate) to retry.

There is no `uploading` status — in-flight state lives in the Outbox's in-memory scheduler, not the DB. `Outbox.isProcessing(id)` answers "is this row currently being attempted."

### Topic

The MQTT destination string that routes a Measurement to the correct AWS IoT rule. Built by `getMultispeqMqttTopic({ experimentId, protocolId })`. The `protocolId` value `"questions"` is a sentinel for question-only uploads (no MultispeQ sample).

### Bundle

N Measurements produced by one Multi-scan round, correlated only by `bundle_id` (uuid), `bundle_size`, and `device_index` fields embedded in each otherwise-ordinary wire payload. There is no bundle entity locally or server-side — "not bundled" simply means the fields are absent. Don't say "bundle upload": there is no batched publish; the Outbox still sends N independent messages.

---

## Devices

### Device registry

The `Map<Device.id, connection>` in `device-connection-manager/serial-port-connection.ts` that holds all open USB serial ports (replacing the former single-connection module variables). USB only — Bluetooth Classic remains max one device. Insertion order = connect order.

### Primary device

The first connected device (first Device registry entry, or the lone Bluetooth device). Legacy single-device surfaces — battery chip, home card, BT flows, `useConnectedDevice()` — bind to it.

### Multi-scan

Running one protocol on all connected devices in parallel (`Promise.allSettled` semantics). Outcomes are per-device; partial failure is allowed — the user can continue with the successful Measurements or retry only the failed devices. Per-device battery tracking is deferred: only the Primary device's battery is stored.

### Transport exclusivity

At any time the app holds up to N USB devices OR exactly one Bluetooth Classic device, never a mix. Connecting on one transport disconnects the other.

---

## Upload pipeline

### Publish

The act of sending one payload to one MQTT topic via the shared Transport. Returns a promise that resolves when the broker acks the message (QoS 1) or rejects with a typed error. **Publish is a transport-level concept.** It says nothing about local persistence or retry.

### Upload

The end-to-end act of getting a stored Measurement onto the cloud: save → enqueue → worker reads payload → publish → mark successful. **Upload is an orchestration-level concept.** Callers see "save + enqueue"; the rest lives behind the Outbox.

### Outbox

Module-singleton orchestrator that drives `pending` and `failed` Measurement rows to the broker. Wraps `@tanstack/pacer` AsyncQueuer at concurrency 8. Holds measurement IDs only — the DB is the source of truth for payloads.

Responsibilities:

- Discover work: scan `status="pending"` / `status="failed"` on cold start and on app foreground (rehydrate).
- Schedule: per-row retry via AsyncRetryer (3 attempts, 1s/4s/15s backoff). Exhaustion marks the row `failed`.
- Pause on offline (single network listener), resume on reconnect.
- Status transitions: `pending`/`failed` → `successful` on PUBACK.
- Own all upload-progress reactivity. No sibling "outbox state" module — the Outbox is the single source.

Reactive surface (all subscribe APIs return an unsubscribe fn):

- `isProcessing(id): boolean` — snapshot read.
- `subscribeProcessing(id, cb)` — wakes only listeners watching that id. Backed by an internal `Map<id, Set<cb>>`. Settling id X wakes X's listeners only, not all N visible rows.
- `subscribeSettled(cb: (items: ReadonlyArray<{ id, status }>) => void)` — batched. A burst of PUBACKs inside one JS turn collapses to a single dispatch via an internal `@tanstack/pacer` `Batcher` (`wait: 0`). The event carries the terminal status, so downstream consumers don't re-read the DB.
- `getSnapshot(): { isUploading, count }` + `subscribeSnapshot(cb)` — for toolbars / tab badges.

Pattern reference: transactional Outbox (Chris Richardson). The `_client_id` field embedded in the wire payload is the dedup key — an AWS IoT Rule deduplicates re-publishes after a crash between PUBACK and `markAsSuccessful`.

### Measurement list cache

The react-query cache that backs the Recent Measurements list. Keyed by filter (`["measurements", "list", filter]`), plus sibling keys for status counts and the pending-or-failed lookup.

`features/recent-measurements/services/measurement-list-cache.ts` is the single home of:

- `queryKeys` — the canonical key builder. Every consumer (hooks, bridge, invalidations) goes through it.
- `applySettledPatchBatch(queryClient, items)` — pure cache mutator. Given `{id, status}[]` from the Outbox, flips row status in cached pages (or drops the row when status no longer matches the page's filter), updates status counts, and patches the pending-or-failed key. **No SQLite reads.** Unchanged rows keep their object refs so memo'd list items skip re-renders.

The patcher is pure (queryClient + items in, mutations out). Unit-testable without rendering hooks.

### Outbox bridge

The wire from Outbox settled events to the Measurement list cache. Lives in `features/recent-measurements/services/outbox-to-query-cache-bridge.ts`, mounted **once** at the app root (`app/_layout.tsx`) via `mountOutboxBridge(queryClient)`, which returns an unmount fn.

Always-on. Same fresh cache for Recent + Home tab. No per-screen focus gate. Cost per burst = one `setQueryData` per affected query per microtask, no DB.

Tests substitute a fake Outbox (emit settled events) and a fresh `QueryClient`.

### Transport

The thin MQTT seam. One paho-mqtt client per Transport instance, lazily connected on first publish, idle-disconnected after 30 seconds, reconnected lazily on the next publish after a disconnect.

Interface: `publish(topic, payload): Promise<void>` — resolves on PUBACK, rejects on timeout / disconnect / broker-side error. Plus lifecycle: `destroy`. Owns its own connection state; callers never call `connect`.

Transport does NOT retry. A failed publish rejects. The Outbox decides whether to re-attempt. This makes the Outbox the single home of the retry schedule.

Throws typed errors: `{ kind: "PublishError" | "Disconnected" | "Timeout" | "CredentialError" }`. Callers (the Outbox worker) map `kind` to retryable / terminal via `isRetryableMqttError`.

Constructor takes a `transportFactory` so tests inject a fake instead of mocking paho-mqtt + AWS SDK.

---

## Architecture conventions

### Boundaries

Feature folders (`features/<f>/`) expose their `hooks/`, `stores/`, `services/`, `utils/` and types; `screens/` and `components/` are private to the feature. `shared/` may never import from `features/` — except `shared/composition/`, the sanctioned wiring layer (and test files, which wire features the way composition does). Enforced by `no-restricted-imports` blocks in `eslint.config.mjs`; the legacy lists there only shrink.

### Domain modules

Pure rules live in `features/<f>/domain/` as per-transition functions returning `Partial<State>` plus derivation predicates; zustand stores are thin wrappers whose actions delegate (`nextStep: () => set(nextStepState)`). Reference implementations: `measurement-flow/domain/flow-transitions.ts` + `domain/iteration.ts`, `calibration/domain/calibration-transitions.ts`. Imperative multi-store orchestration goes in a feature service (`measurement-flow/services/flow-actions.ts`: `advanceWithAnswer`, `teardownFlow`) — components never run logic over `getState()`.

### Flow session persistence

The two flow stores (`measurement-flow-storage`, `flow-answers-storage`) are pinned at persist `version: 0`; their `partialize` output is the wire format, locked by `flow-store-persistence.test.ts`. Renaming/removing a persisted field without a version bump + real `migrate` silently wipes a paused field flow. Cross-store consistency after hydration is enforced by `stores/flow-rehydration-guard.ts`, mounted at boot.

### Device ops

`connection/services/device-connection-manager/device-connection.ts` holds the single `Record<DeviceType, ops>` decision table over transports (connect/disconnect/unpair/createExecutor). Nothing else switches on `device.type`. Frame parsing is one shared `parseMultispeqFrame` for every transport. Disconnect detection (native event + query-cache subscriber) is `mountConnectionLifecycle`, mounted once at boot like the Outbox bridge. Battery is the react-query cache via `useBatteryLevel` — no store mirror.

### Composition root

`shared/composition/` is where singletons are built and features are wired together: `upload.ts` (Transport→Outbox), `app-providers.tsx` (provider pyramid), `app-bootstrap.tsx` (boot effects: outbox bridge, connection lifecycle, rehydration guard, auth-wiring side effect), `auth-wiring.ts` (fetcher 401 seam), `prefetch-offline-data.ts`. The expo-router layer stays thin.

### User-facing strings

No hardcoded user-visible English. Toasts/alerts resolve through i18n (`useTranslation` in hooks/components, `i18n.t` in services) with keys in BOTH `en-US` and `nl-NL`. Error feedback lives in hooks/mutation callbacks, not component bodies; the global `QueryCache.onError` shows `error.body.message` when the API provided copy and a translated generic otherwise.

---

## External systems referenced

### AWS IoT Core

Managed MQTT broker that ingests measurements. Reached via a Cognito-signed WebSocket URL. Receives QoS 1 publishes, dedupes on a downstream rule using the embedded row UUID.

### Cognito Identity Pool

Provides short-lived AWS credentials used to sign the MQTT WebSocket URL. Credentials are cached in `aws-iot-auth.ts` (identity-id + creds + SigV4 signed URL) and refreshed before expiry. The PahoSession factory imports from there; nothing else does.

### paho-mqtt

The MQTT-over-WebSocket client library wrapped by `mqtt-paho-session.ts`. The Transport never touches paho directly — it goes through `PahoSession`.

### `@tanstack/pacer`

Provides the AsyncQueuer (concurrency + reactive state) and AsyncRetryer (per-item retry with backoff) primitives. The Outbox uses both. Transport does not — its reconnect is lazy on the next publish, not a separate retry loop.

---

## Vocabulary discipline

- Don't say "MQTT connection" in product/UX copy — say "Upload connection."
- Don't say "queue lock" or "claim" — those concepts were the previous design's DB soft-lock and no longer exist.
- Don't say "MqttPublisher", "publisher pool", "slot", or "held queue" — that pool layer was removed; there is one Transport, one paho client. The Outbox is the only queue.
- Don't say "UploadQueue" — the durable concept is **Outbox**; the in-memory scheduler is an implementation detail of it.
- Don't say "outbox-state" or "outbox state module" — upload-progress reactivity is part of the **Outbox** itself. There is no sibling module.
- "Concurrency" refers to Outbox pipeline depth, not "how many MQTT connections" (there is only ever one).
- A "burst upload" = many Measurements enqueued at once after offline → online transition.
- Don't say "settle bridge useEffect on the Recent screen" — the **Outbox bridge** is mounted once at the app root.
