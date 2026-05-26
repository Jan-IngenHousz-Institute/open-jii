# Upload Timing Analysis

> **Historical — snapshot at capture time.** This analysis describes the
> 4-transport parallel pool (≈20 in-flight slots) that has since been replaced
> by a single session draining at `UPLOAD_CONCURRENCY` (8). The "20 slots" /
> "20 cap" figures below reflect that older configuration, not the shipped one.

Source: log capture 16:20:54 – 16:23:17. Two batches of 50 measurements each, 244 bytes payload, QoS 1, MQTT publish to AWS IoT.

## Batch 1 — cold start, 50 msgs

- Enqueue → last PUBACK: **~3.5s** (16:20:54.5 → 16:20:57.99)
- Connect phase: 4 transports parallel, total_ms 1860–1900
  - `creds_ms` 1448–1494 (dominant — credential fetch/sign)
  - `sign_ms` 30–39
  - `paho_ms` 353–378
- First 20 msgs: blocked on connect → `queue_ms` 1679–1718, `wire_ms` 55–689 (HoL grows as slot fills)
- Remaining 30 (post-connect): `queue_ms` 0–4, `wire_ms` 271–656
- Per-msg `total_ms`: 1730 (best) → 3956 (worst)

**Bottleneck batch 1**: credential fetch (~1.5s) gates all 4 transport connects. 70% of first-msg latency.

## Batch 2 — warm? no, degraded, 50 msgs

- Enqueue 16:21:14.925 → last PUBACK 16:22:47.94 = **~93s** (26× slower)
- 50 publishes queued in 300ms (heldRemaining=0, all 20 slots saturated immediately)
- `wire_ms` grows monotonically: 1510 → 21731 ms
- `queue_ms` stays low (0–8ms) — not local queueing
- `worker_pickup` delay grows: 0 → 75201ms (worker serialized waiting on `slot_send`)
- Per-msg `total_ms`: 1730 → 91423

**Bottleneck batch 2**: broker/network ack latency. Each PUBACK takes ~17-21s. 20 in-flight cap → throughput = 20 / 21s ≈ 1 msg/s. 50 msgs / 1 msg/s ≈ 50s drain.

## Why batch 2 wire_ms exploded

Connects still warm (no reconnect log between batches). Symptoms point to:

- Server-side ingest backpressure (AWS IoT Rule/Lambda/Timestream throttling)
- OR cellular RTT degraded mid-test
- Wire growth pattern (linear ramp from 1.5s → 21s) = queue building somewhere downstream, not random jitter

## Transport idle close

`16:23:17.935 idle — closing all transports afterMs=30000`. Next batch will pay full ~1.9s connect cost again.

## Key fixes ranked by impact

1. **Cache creds** beyond transport lifetime — saves 1.5s per cold start (biggest win for occasional uploads)
2. **Investigate broker-side wire_ms** — 17-21s PUBACK is not normal; AWS IoT typical <100ms. Check Rule action latency, throttling metrics
3. **Increase idle timeout** past 30s OR keep 1 transport warm for trickle uploads
4. **Per-slot in-flight=5 × 4 slots = 20 cap** — fine for healthy broker, hides nothing when broker slow

## Numbers at a glance

| Metric             | Batch 1  | Batch 2   |
| ------------------ | -------- | --------- |
| 50 msgs total time | 3.5s     | 93s       |
| First msg total_ms | 1730     | 1730      |
| Last msg total_ms  | 3956     | 91423     |
| Median wire_ms     | ~500     | ~18500    |
| Throughput         | 14 msg/s | 0.5 msg/s |
