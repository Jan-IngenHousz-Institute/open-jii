# Publisher Slot Balance Fix

## Symptom

Log evidence: 10 sequential msgs from one batch all land on `slot=0` or `slot=1`. Slots 2..N idle. `wire_ms` ramps 813 → 3060 (linear) while `queue_ms` flat ~1185.

## Root cause

`MqttPublisherImpl.drain()` and `fillSlot()` use greedy per-slot fill:

```ts
for (const slot of this.slots) {
  if (slot.transport) this.fillSlot(slot); // drains up to MAX_IN_FLIGHT_PER_SLOT into ONE slot
}
```

First connected slot gets saturated before next slot sees any work. Behind a single TCP socket, broker PUBACKs serialize → nth msg waits for n-1 PUBACKs.

## Fix: round-robin distribution

Replace greedy `fillSlot` with single-shot send + outer round-robin loop in `drain()`.

### Changes

`mqtt-publisher.ts`:

1. Split `fillSlot` into `trySendOne(slot)` returning boolean (sent or not).
2. `drain()`:
   - Pass A: round-robin across connected slots, send 1 each per pass, until either held empty OR no slot has capacity.
   - Pass B: if still held, bring up additional slots (existing logic, but count actual free capacity not theoretical max).
3. PUBACK callback (`wireSlot.onDelivered`): instead of `fillSlot(slot)`, call shared `drain()` so freed capacity may pick from least-loaded slot.
4. Optional: sort slots by `inFlight.size` ascending before each round-robin pass for least-loaded-first.

### Pseudocode

```ts
private drain(): void {
  if (this.destroyed || this.held.length === 0) return;

  // Pass A: round-robin across connected slots
  let progress = true;
  while (this.held.length > 0 && progress) {
    progress = false;
    const connected = this.slots
      .filter(s => s.transport && s.inFlight.size < MAX_IN_FLIGHT_PER_SLOT)
      .sort((a, b) => a.inFlight.size - b.inFlight.size);
    for (const slot of connected) {
      if (this.held.length === 0) break;
      if (this.trySendOne(slot)) progress = true;
    }
  }

  // Pass B: open more slots if still held
  let freeCap = 0;
  for (const s of this.slots) {
    if (s.transport) freeCap += MAX_IN_FLIGHT_PER_SLOT - s.inFlight.size;
    else if (s.connecting) freeCap += MAX_IN_FLIGHT_PER_SLOT;
  }
  let remaining = this.held.length - freeCap;
  for (const slot of this.slots) {
    if (remaining <= 0) break;
    if (slot.transport || slot.connecting) continue;
    void this.ensureSlotConnected(slot).then(t => { if (t) this.drain(); });
    remaining -= MAX_IN_FLIGHT_PER_SLOT;
  }
}
```

## Expected impact

- Burst of 50 msgs across 4 connected slots: each slot carries ~12-13 in-flight instead of 20 + 0 + 0 + 0.
- `wire_ms` ramp slope cuts ~4× (parallel TCP sockets, parallel PUBACK streams).
- Combined with Kinesis throttle fix (separate ticket), batch-2-style 93s collapses toward ~25s.

## Test plan

- Unit: enqueue 20 items with pool=4, cap=5. Assert each slot gets 5.
- Integration log check: post-fix, expect all 4 slot indices in `slot_send` events for a 50-msg batch.
- Perf: re-run 2-batch test, compare `total_ms` p95 and `wire_ms` curve.
