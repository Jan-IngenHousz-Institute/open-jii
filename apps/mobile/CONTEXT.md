# Mobile — Domain Context

Living glossary for the Field Companion (mobile app). Terms used in code, tests, PRs, and ADRs must match this file. When code introduces a concept that isn't here, add it here first.

---

## Core entities

### Measurement
A single sample produced by a MultispeQ device for a given experiment + protocol, optionally accompanied by user-answered questions, macro output, and annotations. Persisted locally in SQLite (`shared/db/measurements-storage.ts`) before any cloud upload is attempted.

### Status
The lifecycle of a stored Measurement on-device:

- **pending** — saved locally, not yet acknowledged by the cloud. May be sitting in the UploadQueue, paused offline, or waiting for boot rehydration.
- **successful** — broker (AWS IoT) has acknowledged receipt (QoS 1 PUBACK).
- **failed** — UploadQueue has exhausted its retry policy. Requires user action to retry.

There is no `uploading` status — in-flight state lives in the queue, not the DB. `UploadQueue.isProcessing(id)` answers "is this row currently being attempted."

### Topic
The MQTT destination string that routes a Measurement to the correct AWS IoT rule. Built by `getMultispeqMqttTopic({ experimentId, protocolId })`. The `protocolId` value `"questions"` is a sentinel for question-only uploads (no MultispeQ sample).

---

## Upload pipeline

### Publish
The act of sending one payload to one MQTT topic via the shared MqttPublisher. Returns a promise that resolves when the broker acks the message (QoS 1) or rejects with a typed PublishError. **Publish is a transport-level concept.** It says nothing about local persistence or retry.

### Upload
The end-to-end act of getting a stored Measurement onto the cloud: save → enqueue → worker reads payload → publish → mark successful. **Upload is an orchestration-level concept.** Callers see "save + enqueue"; the rest lives behind UploadQueue.

### MqttPublisher
Module-singleton transport for all outbound MQTT messages. One persistent paho-mqtt connection per session, lazily connected on first publish, idle-disconnected after 30 seconds with no traffic, transparently reconnected on connection loss (pending publishes are held and retried, callers never see the disconnect). Uses QoS 1. Refreshes Cognito credentials proactively at T−5 min before expiry.

Constructor takes a `transportFactory` so tests inject a fake `Transport` instead of mocking paho-mqtt + AWS SDK.

Throws typed errors: `{ kind: "PublishError" | "Disconnected" | "Timeout" | "CredentialError" }`. The publisher never imports translation strings — callers map `kind` to user-facing messages.

### Transport
The internal seam between MqttPublisher and the underlying MQTT client. Interface: `connect`, `publish`, `onDisconnect`, `onMessageDelivered`, `destroy`. The production adapter wraps paho-mqtt + Cognito SigV4 signing. The test adapter is a synchronous in-memory fake.

### UploadQueue
Module-singleton orchestrator wrapping `@tanstack/pacer` AsyncQueuer. Holds measurement IDs only (the DB is the source of truth for payloads). Drives the upload worker at concurrency 8. Layered with an AsyncRetryer (3 attempts, 1s/4s/15s backoff) per item — exhausted items mark the DB row as `failed`. Paused when the device is offline (single network listener) and resumed on reconnect. Rehydrates from `pending|failed` rows on cold start and on app foreground.

### Upload worker
The function the UploadQueue invokes per item. Reads the measurement by ID, builds the payload (with the row's UUID embedded for AWS IoT–side deduplication), calls `MqttPublisher.publish(topic, payload)`, marks `successful` on resolve / `failed` after retry exhaustion.

---

## External systems referenced

### AWS IoT Core
Managed MQTT broker that ingests measurements. Reached via a Cognito-signed WebSocket URL. Receives QoS 1 publishes, dedupes on a downstream rule using the embedded row UUID.

### Cognito Identity Pool
Provides short-lived AWS credentials used to sign the MQTT WebSocket URL. Credentials are cached in `create-mqtt-connection.ts` and refreshed before expiry by MqttPublisher's scheduler.

### paho-mqtt
The MQTT-over-WebSocket client library wrapped by Transport. Not referenced anywhere outside `mqtt-transport.ts`.

### `@tanstack/pacer`
Provides the AsyncQueuer (concurrency + reactive state) and AsyncRetryer (per-item retry with backoff) primitives. UploadQueue uses AsyncQueuer + AsyncRetryer; MqttPublisher uses AsyncRetryer to drive its transport reconnect schedule. Already a dependency; was previously used only by `time-sync` as a Debouncer.

---

## Vocabulary discipline

- Don't say "MQTT connection" in product/UX copy — say "Upload connection."
- Don't say "queue lock" or "claim" — those concepts were the previous design's DB soft-lock and no longer exist.
- "Concurrency" refers to UploadQueue pipeline depth, not "how many MQTT connections" (there is only ever one).
- A "burst upload" = many Measurements enqueued at once after offline → online transition.
