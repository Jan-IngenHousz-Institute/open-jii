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
- Expose reactive `{ isUploading, count }` snapshot and `isProcessing(id)` to the React UI.

Pattern reference: transactional Outbox (Chris Richardson). The `_client_id` field embedded in the wire payload is the dedup key — an AWS IoT Rule deduplicates re-publishes after a crash between PUBACK and `markAsSuccessful`.

### Transport

The thin MQTT seam. One paho-mqtt client per Transport instance, lazily connected on first publish, idle-disconnected after 30 seconds, reconnected lazily on the next publish after a disconnect.

Interface: `publish(topic, payload): Promise<void>` — resolves on PUBACK, rejects on timeout / disconnect / broker-side error. Plus lifecycle: `destroy`. Owns its own connection state; callers never call `connect`.

Transport does NOT retry. A failed publish rejects. The Outbox decides whether to re-attempt. This makes the Outbox the single home of the retry schedule.

Throws typed errors: `{ kind: "PublishError" | "Disconnected" | "Timeout" | "CredentialError" }`. Callers (the Outbox worker) map `kind` to retryable / terminal via `isRetryableMqttError`.

Constructor takes a `transportFactory` so tests inject a fake instead of mocking paho-mqtt + AWS SDK.

---

## External systems referenced

### AWS IoT Core

Managed MQTT broker that ingests measurements. Reached via a Cognito-signed WebSocket URL. Receives QoS 1 publishes, dedupes on a downstream rule using the embedded row UUID.

### Cognito Identity Pool

Provides short-lived AWS credentials used to sign the MQTT WebSocket URL. Credentials are cached in `create-mqtt-connection.ts` and refreshed before expiry.

### paho-mqtt

The MQTT-over-WebSocket client library wrapped by Transport. Not referenced anywhere outside `mqtt-transport.ts`.

### `@tanstack/pacer`

Provides the AsyncQueuer (concurrency + reactive state) and AsyncRetryer (per-item retry with backoff) primitives. The Outbox uses both. Transport does not — its reconnect is lazy on the next publish, not a separate retry loop.

---

## Vocabulary discipline

- Don't say "MQTT connection" in product/UX copy — say "Upload connection."
- Don't say "queue lock" or "claim" — those concepts were the previous design's DB soft-lock and no longer exist.
- Don't say "MqttPublisher", "publisher pool", "slot", or "held queue" — that pool layer was removed; there is one Transport, one paho client. The Outbox is the only queue.
- Don't say "UploadQueue" — the durable concept is **Outbox**; the in-memory scheduler is an implementation detail of it.
- "Concurrency" refers to Outbox pipeline depth, not "how many MQTT connections" (there is only ever one).
- A "burst upload" = many Measurements enqueued at once after offline → online transition.
