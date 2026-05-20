# MQTT + Upload Pipeline Refactor — Handover

**Status**: design locked, implementation not yet started
**Scope**: `apps/mobile/src/features/connection/services/mqtt/` and `apps/mobile/src/features/recent-measurements/`
**Author of design**: pairing session, 2026-05-20
**Glossary**: see [`apps/mobile/CONTEXT.md`](../CONTEXT.md)

---

## 1. Problem

Two coupled architectural problems in the mobile upload pipeline.

### 1a. One MQTT connection per message

Today's `sendMqttEvent(topic, payload)` (`features/connection/services/mqtt/send-mqtt-event.ts`) opens a brand-new MQTT connection for every single publish:

1. Fetch Cognito identity ID
2. Get temporary AWS credentials
3. Build a SigV4-signed WebSocket URL
4. Open a fresh paho-mqtt TLS connection
5. Send ONE message
6. Disconnect

Burst uploads (e.g. 10 measurements queued after offline reconnect) pay this cost 10×. The codebase's hand-rolled `CONCURRENCY = 3` worker pool in `use-measurements.ts:55` exists **purely to throttle below Cognito's identity-pool rate limit** — a workaround that wouldn't exist if connections were reused.

`sendMqttEvent` is also a shallow module: its interface is nearly as complex as its implementation (timeout race, destroy plumbing leaking into the caller), and the deletion test concentrates no complexity if removed — the work just moves to a deeper module.

### 1b. Upload orchestration sprawled across 4 hooks

The same `save → claim → publish → mark` sequence is hand-rolled in:

- `use-measurement-upload.ts` (single measurement)
- `use-questions-upload.ts` (questions-only)
- `use-measurements.uploadAll` (batch retry, with custom worker pool)
- `use-measurements.uploadOne` (single retry)

Plus `use-auto-upload.ts` re-implements an in-flight guard with refs and listens on three separate triggers (initial mount, AppState foreground, network restore). The DB's `uploading` status doubles as a soft-lock against double-publishes by parallel triggers, and `resetUploadingMeasurements()` exists to clean up rows stuck in this state after a crash.

The interface is wide (`claimForUpload`, `markAsUploading`, `markUploaded`, `markFailed`) precisely because **there is no queue** — the DB row's status is being used as a queue.

---

## 2. Goals

1. One persistent MQTT connection per session, shared by all publishes.
2. Real broker-level delivery guarantee (move from QoS 0 fire-and-forget to QoS 1 acked).
3. Single orchestration point for all uploads with concurrency, retry, pause-on-offline, and crash-safe rehydration handled in one place.
4. Each upload callsite shrinks to "save locally + enqueue."
5. Test surface: fake transport + fake publisher, not mocked paho/Cognito/AppState/network/React Query.

---

## 3. Architecture

### 3.1 MqttPublisher (deep module — transport layer)

**Location**: `apps/mobile/src/features/connection/services/mqtt/`

**Files**:

| File | Responsibility |
|------|----------------|
| `mqtt-errors.ts` | Typed error kinds: `PublishError`, `Disconnected`, `Timeout`, `CredentialError`. Each carries a stable `kind` string callers map to translation keys. |
| `mqtt-transport.ts` | `Transport` interface (`connect`, `publish`, `onDisconnect`, `onMessageDelivered`, `destroy`) + production adapter wrapping paho-mqtt + Cognito SigV4. Re-uses existing `createSignedUrl` and `getCredentials` from `create-mqtt-connection.ts`. |
| `mqtt-publisher.ts` | Module singleton. The deep module. |
| `__tests__/mqtt-publisher.test.ts` | Fake-transport tests. |

**Interface**:

```ts
interface MqttPublisher {
  publish(topic: string, payload: object): Promise<void>;
}

export function getPublisher(): MqttPublisher;
```

That's it. Callers know nothing about Cognito, paho, signing, reconnect, or timeouts.

**Behaviour behind the seam**:

- **Lazy connect**: first `publish()` triggers the Cognito + signed-URL + paho handshake. Idle apps pay nothing.
- **QoS 1**: every publish is built as a `Message` with `qos = 1`. Resolution is keyed off paho's `onMessageDelivered` callback (which fires on broker PUBACK at QoS 1).
- **Concurrent in-flight**: pending publishes correlated by `messageIdentifier`. State: `Map<number, { resolve, reject, topic, payload, attempt }>`. Multiple publishes pipelined on the single connection — the queue's concurrency=8 actually pipelines on the wire.
- **Idle die**: 30 seconds after the last publish resolves AND the pending map is empty, the publisher closes the transport. Next publish triggers a fresh lazy connect.
- **Creds refresh**: scheduler ticks at T−5 min before known cred expiry. Triggers a graceful reconnect — new connection opens, pending publishes migrate to the new connection (resent), old connection closes. Hidden from callers.
- **Reconnect on loss** (`onDisconnect`): pending publishes are **held**, not failed. Publisher reconnects with backoff (1s/4s/15s, then give up) — driven by `@tanstack/pacer` AsyncRetryer with a function-form `baseWait` so the schedule is exact rather than approximated by exponential+cap. On success, all held publishes are re-sent on the new connection. If reconnect fails after backoff exhaustion, all held publishes reject with `kind: "Disconnected"`.
- **Errors**: typed only. The publisher never imports `i18n`.

**Test seam**: `getPublisher()` is the production accessor. Tests construct `new MqttPublisher({ transportFactory: fakeTransportFactory, clock: fakeClock })` directly. The fake transport is a synchronous in-memory broker that lets tests trigger `onMessageDelivered`, `onDisconnect`, and cred-expiry events deterministically.

**Why deep**: callers go from knowing paho + Cognito + timeouts + destroy patterns to knowing `publish(topic, payload)`. All connection-lifecycle bugs concentrate in one file.

### 3.2 UploadQueue (deep module — orchestration layer)

**Location**: `apps/mobile/src/features/recent-measurements/services/`

**Files**:

| File | Responsibility |
|------|----------------|
| `upload-queue-state.ts` | Dependency-free state module: `subscribe`, `getSnapshot`, `isProcessing`, internal `markEnqueued`/`markSettled`. The React UI imports only from here, keeping the MQTT chain out of component-test module graphs. |
| `upload-queue.ts` | Module singleton wrapping `@tanstack/pacer` AsyncQueuer. Holds measurement IDs only. Calls `markEnqueued` / `markSettled` so the state module stays in sync. |
| `upload-worker.ts` | The function the queue invokes per item. Reads payload from DB, calls publisher, updates status. Wrapped in AsyncRetryer. |
| `use-upload-queue-state.ts` | React hook: `useUploadQueueState()` returns `{ isUploading, count }`; `useIsProcessing(id)` is a per-row reactive selector. |
| `__tests__/upload-queue.test.ts` | Fake-publisher tests. |

**Interface**:

```ts
interface UploadQueue {
  enqueue(id: string): void;
  isProcessing(id: string): boolean;
  // pause/resume managed internally by network listener; not part of public surface
}

export function getUploadQueue(): UploadQueue;
```

**Behaviour behind the seam**:

- **Items are IDs only**. The DB is the source of truth for payloads — keeps large compressed samples out of memory, makes rehydration on cold start trivial.
- **Concurrency = 8**. Pipelines bursts through the single MQTT connection. Real throughput gain because QoS 1 round-trips (50–500ms to AWS) are now overlapped.
- **AsyncRetryer**: 3 attempts per item with 1s / 4s / 15s backoff. Exhaustion marks the DB row `failed`. Publisher's own hold+retry already absorbs network blips, so retries here only fire on **real** errors (auth, broker reject, bad payload).
- **Payload UUID injection**: the worker injects the row's `id` into the published payload before sending. An AWS IoT rule deduplicates downstream on this UUID, protecting against the rare double-publish window between paho-ack and `markAsSuccessful` if the app crashes mid-update.
- **Pause on offline**: a single `expo-network` listener at module init flips `queue.setPaused(!isInternetReachable)`. Replaces the entire `use-auto-upload.ts` trigger fan-out.
- **Boot + foreground rehydration**: on app start and on AppState foreground, the queue loads all `pending` and `failed` rows from the DB and enqueues any IDs not currently in-flight. The "not currently in-flight" check uses the queue's own state — no DB locking needed.

**Worker pseudocode**:

```ts
async function uploadWorker(id: string) {
  const row = await getMeasurementById(id);
  if (!row || row.status === "successful") return;

  const payload = {
    ...row.measurementResult,
    _client_id: id,                              // AWS dedup key
  };

  try {
    await getPublisher().publish(row.topic, payload);
    await markAsSuccessful(id);
  } catch (err) {
    if (isRetryable(err)) throw err;             // AsyncRetryer catches
    await markAsFailed(id);
  }
}
```

**Why deep**: concurrency, retry, dedup, pause-on-offline, ordering all live in one module. Today these are spread across 4 hooks plus a custom worker pool plus a ref-based in-flight guard plus a DB soft-lock.

### 3.3 Hooks (the thin layer)

After the refactor, the upload hooks lose ~85% of their code. They become thin save-and-enqueue wrappers:

```ts
// use-measurement-upload.ts — full mutationFn
const savedId = await saveMeasurement(failedUploadData, "pending");
getUploadQueue().enqueue(savedId);
toast.info(t("...savedQueued"));
```

`use-questions-upload.ts` is structurally identical with a different payload shape. `uploadAll` becomes "enqueue every `pending|failed` ID." `uploadOne` becomes `enqueue(id)`. `use-auto-upload.ts` is deleted entirely.

### 3.4 UI

`isUploading`, `uploadProgress`, and the "Uploading…" spinner per row all read from `useUploadQueueState()`. Per-row status (`pending`/`successful`/`failed`) continues to come from React Query's measurements query — no change there. The hand-built `uploadProgress: { done, total }` derives from queue size.

---

## 4. Why these decisions (rationale log)

### Lazy connect over eager connect
Eager would pay the handshake on every app foreground even when the user is just checking the app. Lazy with idle-die gives the best of both: fast subsequent publishes within a session, zero cost when idle.

### Bump to QoS 1
Today's QoS 0 means `messageDelivered` fires on **socket write**, not broker ack. A network drop between phone and AWS silently loses the message. Field measurements can take half a day to collect and the device may be offline at upload time — silent loss is unacceptable. QoS 1 costs one round-trip per message; pipelining (concurrency 8) hides almost all of it.

### Concurrency = 8 (not 1, not 3)
- `1` (serial) would underutilise the QoS 1 pipeline.
- `3` is the legacy Cognito-throttle number — irrelevant once we have one connection.
- `8` pipelines a typical field burst (≤50 measurements) in 6–7 round-trips. AWS IoT broker `Receive Maximum` comfortably above this.

### Transparent reconnect (publisher hides disconnects from queue)
Two options were considered:
- (a) Publisher rejects on disconnect → queue's AsyncRetryer reschedules.
- (b) Publisher holds + retries → queue never sees disconnect.

Chose (b). Network drops are the **expected** failure on a mobile device — every queue retry would be polluted with disconnect noise, distorting the retry backoff schedule. The publisher's reconnect loop is cleaner because it knows about creds, the broker, and the held publishes. The queue stays dumb: it retries only on **semantic** failures (auth, payload, broker reject).

### Drop `"uploading"` status
The status was a soft-lock to prevent the AppState/network/initial-mount trigger fan-out from double-publishing the same row. With a single queue and a single network listener, dedup is trivial (`queue.isProcessing(id)`) and the DB stops being a poor-man's queue. Also kills `resetUploadingMeasurements()` (crash-recovery for stuck rows).

### Embed row UUID in payload for AWS dedup
QoS 1 prevents in-session duplicates (paho's PUBACK retransmit logic handles it). But cross-session dups remain: if the app dies between broker-ack and `markAsSuccessful`, the row stays `pending` and gets re-published on next boot. UUID + IoT rule-side dedup is ~5 lines and guarantees exactly-once **downstream**.

### Idle-die at 30s
Long-lived TCP idle is fine on AWS IoT (broker won't drop). 30s is enough to span the gap between two manual measurements but short enough to free the socket on a phone switched to background.

### `@tanstack/pacer` over hand-rolled queue
Already a project dependency (used by `time-sync`). Ships AsyncQueuer + AsyncRetryer + reactive state. No new runtime weight. AsyncRetryer is used twice — UploadQueue layers it around the upload worker, and MqttPublisher uses it for transport reconnect backoff — keeping one retry vocabulary across the codebase.

### Why not Provider/Context for the publisher and queue?
React Context adds a render-time dependency for what is fundamentally a singleton transport. Module singletons keep them callable from non-React code (storage migrations, background tasks) and match the pattern of `time-sync.ts`. The UI consumes their reactive state via dedicated hooks (`useUploadQueueState`).

---

## 5. Implementation plan

Two phases, strictly sequential. Phase 1 swaps the transport without changing the upload orchestration; Phase 2 replaces orchestration. Each phase must build and pass manual smoke before the next starts.

### Phase 1 — MqttPublisher

| Step | Task |
|------|------|
| 1.1 | `mqtt-errors.ts` and `mqtt-transport.ts` (Transport interface, paho adapter, fake-transport stub used in tests). |
| 1.2 | `mqtt-publisher.ts` singleton with lazy connect, QoS 1, message-id correlation, idle-die, creds refresh, transparent reconnect. |
| 1.3 | Publisher tests: single-connect-N-publishes, reconnect-during-pending, creds-refresh-drain, idle disconnect after 30s, error mapping, exhausted reconnect rejects pending. |
| 1.4 | Migrate the 4 `sendMqttEvent` callsites to `getPublisher().publish(...)`. Delete `send-mqtt-event.ts`. Leave the `CONCURRENCY=3` worker pool untouched in this phase — it's now wasteful but harmless. |
| 1.5 | Build mobile app. Manual smoke: upload single measurement online; upload during simulated network drop+restore; upload near cred-expiry boundary. |

**Definition of done for Phase 1**: every publish goes through the singleton, all existing tests pass, manual smoke clean.

### Phase 2 — UploadQueue

| Step | Task |
|------|------|
| 2.1 | Drizzle migration: drop `"uploading"` from the status enum. Migrate any in-flight `uploading` rows back to `pending` in the migration script. |
| 2.2 | `upload-queue.ts` (AsyncQueuer, concurrency 8) + `upload-worker.ts` (read DB, inject UUID, publish, mark) wrapped in AsyncRetryer (3 attempts, 1s/4s/15s). |
| 2.3 | `use-upload-queue-state.ts` hook exposing `isUploading`, `count`, `isProcessing(id)`. |
| 2.4 | Deflate `use-measurement-upload.ts` and `use-questions-upload.ts` to save+enqueue. Rewrite `uploadAll`/`uploadOne` in `use-measurements.ts` as enqueue calls. Update UI consumers (`recent-measurements-screen.tsx`, swipeable rows, completed-state) to read from the new hook. |
| 2.5 | Delete: `use-auto-upload.ts`, `claimForUpload`, `markAsUploading`, `resetUploadingMeasurements`, the `CONCURRENCY=3` worker pool, the `uploadingKeysRef` Set, the `autoUploadInFlight` ref. |
| 2.6 | Queue tests with fake publisher: rehydrate on boot, pause flips on network, retry exhaustion marks `failed`, no double-enqueue on rapid foreground events. Manual smoke: offline save → online drain, kill app mid-burst → restart → resumes from DB. |

**Definition of done for Phase 2**: upload hooks ≤30 lines each, queue tests green, manual smoke clean across offline/online/burst/cred-rotation scenarios.

---

## 6. Files added / changed / deleted

### Added (Phase 1)
- `apps/mobile/src/features/connection/services/mqtt/mqtt-errors.ts`
- `apps/mobile/src/features/connection/services/mqtt/mqtt-transport.ts`
- `apps/mobile/src/features/connection/services/mqtt/mqtt-publisher.ts`
- `apps/mobile/src/features/connection/services/mqtt/__tests__/mqtt-publisher.test.ts`

### Added (Phase 2)
- `apps/mobile/src/features/recent-measurements/services/upload-queue.ts`
- `apps/mobile/src/features/recent-measurements/services/upload-worker.ts`
- `apps/mobile/src/features/recent-measurements/hooks/use-upload-queue-state.ts`
- `apps/mobile/src/features/recent-measurements/services/__tests__/upload-queue.test.ts`
- A drizzle migration dropping `"uploading"` from the status enum.

### Changed
- `apps/mobile/src/features/recent-measurements/hooks/use-measurement-upload.ts` (≈220 lines → ≈30)
- `apps/mobile/src/features/recent-measurements/hooks/use-questions-upload.ts` (≈140 lines → ≈30)
- `apps/mobile/src/features/recent-measurements/hooks/use-measurements.ts` (≈220 lines → ≈80; loses worker pool + uploading-keys ref)
- `apps/mobile/src/shared/db/measurements-storage.ts` (drops `markAsUploading` and `resetUploadingMeasurements`)
- `apps/mobile/src/shared/db/schema.ts` (status enum slimmed)
- UI components that read `isUploading`/`uploadProgress` (swap to `useUploadQueueState`)

### Deleted
- `apps/mobile/src/features/connection/services/mqtt/send-mqtt-event.ts`
- `apps/mobile/src/features/recent-measurements/hooks/use-auto-upload.ts`
- The `CONCURRENCY = 3` worker pool inside `use-measurements.uploadMutation`
- `claimForUpload` from `useMeasurements`'s return value
- The `"uploading"` enum value from DB schema + all references

---

## 7. Tests

### Publisher (`mqtt-publisher.test.ts`)
- Single connect across N publishes
- Pending publishes survive a mid-flight disconnect (held, resent, resolve once)
- Exhausted reconnect rejects all pending with `kind: "Disconnected"`
- Cred refresh at T−5min: reconnect happens, in-flight publishes migrate, no caller sees an error
- Idle disconnect fires 30s after last publish resolves
- Error mapping: each transport failure path → expected `kind`

### Queue (`upload-queue.test.ts`)
- Boot rehydration: pre-seeded DB rows enqueue on init
- Pause on offline / resume on online
- Concurrency cap respected
- AsyncRetryer: failure retries 3 times with expected backoff
- Exhausted retries mark row `failed`
- Successful publish marks row `successful`
- No double-enqueue when the same ID is already in-flight (foreground re-enqueue path)
- UUID injection: payload received by fake publisher carries `_client_id` equal to row id

---

## 8. Rollback

Both phases are mergeable independently and revertable independently.

- **Phase 1 rollback**: revert the publisher commit. Callsites go back to `sendMqttEvent`. No DB or schema impact.
- **Phase 2 rollback**: requires a forward migration restoring the `uploading` enum value (one drizzle migration). Re-introduce `markAsUploading` / `claimForUpload` / `resetUploadingMeasurements` from git history. `use-auto-upload.ts` restored.

If only Phase 2 misbehaves, Phase 1's publisher remains valuable on its own (one connection per session vs per message — order-of-magnitude fewer TLS handshakes).

---

## 9. Risks

| Risk | Mitigation |
|------|-----------|
| paho-mqtt `messageIdentifier` semantics differ from docs at QoS 1 | Verify in Phase 1.2 with a smoke test against real AWS IoT before relying on correlation; fall back to a strict-FIFO resolver array if `messageIdentifier` is unreliable. |
| AWS IoT rule-side dedup not configured | Phase 2 is safe without it (rare dups, accepted); rule should be added in parallel by infra team. Tracked separately. |
| Pacer AsyncRetryer API doesn't match our retry shape | Fall back to a thin retry wrapper (~15 lines). No blocker. |
| Mid-migration mobile build with `uploading` enum gone but old client in field | Drizzle migration handles existing on-device rows; binary release boundary controls client code. No staged rollout required. |

---

## 10. Out of scope

- AWS IoT rule changes (dedup, ACLs) — infra team.
- Web app MQTT (different transport, different package).
- BLE/serial communication with MultispeQ device (`packages/iot`) — fully separate concern.
- Retry UX redesign — current per-row "Retry" affordance is preserved.

---

## 11. Open questions for implementers

1. **Where does the queue's network listener live?** `expo-network`'s `addNetworkStateListener` at module init means the listener outlives all component lifetimes. Confirm this matches the team's React Native conventions; alternative is a `_layout.tsx`–scoped wiring.
2. **Schema migration strategy** for any on-device rows in `uploading` status at upgrade time. Simplest: migration sets them to `pending`. Confirm no UX edge cases (e.g. a row stuck `uploading` from a crashed previous version showing in the "synced" tab briefly).
3. **AsyncRetryer availability** — verify in `@tanstack/pacer@^0.19.0`. If absent, ship the thin wrapper noted in section 9.
