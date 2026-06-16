# OJD-1565 — MultispeQ light response curve times out & disconnects

## What the issue actually says

`simple_fluor_light_curve_with_recovery 1` (Dave K) works on PhotosynQ but on the
openJII app **the main blue light stays on (doesn't flash), the MultispeQ times
out and disconnects.** Related: OJD-1513 ("Protocol causes the Jii app to crash"),
GitHub #1557 / #1450. Dosu bot already pinned it to a **hard-coded 60 s driver
timeout** that was bumped 30 s→60 s in PR #1407 but is still too short; it also
noted a `timeout` config field exists but isn't wired in. **Confirmed in code.**

## Root cause (verified)

Canonical driver `packages/iot/src/driver/multispeq/driver.ts`:

```ts
private waitForResponse(): Promise<MultispeqCommandResult> {
  const timeout = setTimeout(() => {
    this.emitter.off("receivedReplyFromDevice", handler);
    reject(new Error("Command timeout"));
  }, MULTISPEQ_FRAMING.DEFAULT_TIMEOUT);   // <-- hard-coded 60_000
  ...
}
```

- `MULTISPEQ_FRAMING.DEFAULT_TIMEOUT = 60_000` (`config.ts:39`).
- `MultispeqTransportConfig.timeout` (`config.ts:28`) **exists but is never read** —
  the driver constructor only takes `logger`. Dead config.
- The light-curve protocol runs **~4 min** → 60 s fires mid-measurement.
- On timeout the driver **only rejects; it never sends the cancel switch `-1+`**
  to the device. So the MultispeQ keeps executing the protocol (blue actinic
  light stays illuminated), then drops the connection. Matches the report exactly.

> `-1+` is the documented MultispeQ cancel switch (PhotosynQ console docs, e.g.
> cmd `1053`: "Cancel the command with `-1+`"). Mobile already exposes it as
> `MULTISPEQ_CONSOLE.CANCEL`.

Note: this driver buffers chunks until `\n` correctly — framing is **not** the
bug. (The older `bluetooth-device-to-multispeq-stream.ts` in the app is a
separate path; ignore for this fix.)

## Why a flat bump is wrong

Setting `DEFAULT_TIMEOUT = 600_000` (Dosu's suggestion) unblocks the light curve
but makes a genuinely dead device hang the UI for 10 min on every command. The
right shape is the one in the ticket discussion: **timeout derived from the
protocol's expected duration + wiggle room**, with a sane floor and ceiling.

## Proposed fix

### 1. Wire the existing `timeout` config + per-command override

- Thread `MultispeqTransportConfig.timeout` into the driver (constructor/init).
- Add an optional `timeoutMs` arg to `execute()` → `waitForResponse(timeoutMs)`,
  falling back to `config.timeout ?? DEFAULT_TIMEOUT`. Keep 60 s default for
  short console commands (battery/hello).

### 2. `estimateProtocolDurationMs(protocol)` — new util in `@repo/iot`

Walk `_protocol_set_`, resolving `v_arrays` refs (`@sN`/`@nN:i` = value, `#lN` =
array length), and sum:

```text
phase i:  pulses[i] * pulse_distance_µs[i] / 1000        (pulse train, ms)
        + pre_illumination duration (resolve @n/@s, ms)
× protocol_repeats × protocol_averages
whole set × set_repeats (resolve #l / literal)
+ autogain blocks (do_once → count once)
```

Deliberately conservative — it sizes a timeout, not science. For protocol 1547
this lands ~90 s+; light-curve-with-recovery ~4 min.

### 3. Caller passes the computed timeout when running a protocol

```text
timeoutMs = clamp(estimate * SAFETY + GRACE, MIN, MAX)
// SAFETY = 2, GRACE = 10_000, MIN = 60_000, MAX = 600_000
```

4-min protocol → ~8 min budget, under the 600 s ceiling; a dead device still
fails in bounded time.

### 4. On timeout, cancel + resync (fixes the stuck light & disconnect)

In `waitForResponse`'s timeout branch, before/with rejecting: `transport.send("-1+\r\n")`
(best-effort) so the device aborts the protocol and turns the light off instead
of running to completion and dropping the link. Flush/clear `commandQueue` so the
late protocol reply can't resolve the next command.

### 5. Surface it in the app UI

Map "Command timeout" → typed `ScanTimeoutError`; add i18n `scanTimeout`
("measurement timed out — retry"). Retry button is already wired in
`measurement-node.tsx` `ErrorState`.

## Files to touch

- `packages/iot/src/driver/multispeq/driver.ts` — read config/`timeoutMs`, send `-1+` on timeout, queue cleanup
- `packages/iot/src/driver/multispeq/config.ts` — keep `timeout`; consider raising `DEFAULT_TIMEOUT` modestly only if needed
- NEW `packages/iot/src/driver/multispeq/estimate-protocol-duration.ts` (+spec, protocol 1547 & the light-curve protocol as fixtures)
- mobile scan path (`use-scanner-command-executor-store.ts` / `useScanner`) — compute estimate, pass `timeoutMs`, map error
- i18n `measurementFlow` — `scanTimeout`

## Open questions

- Get the exact `simple_fluor_light_curve_with_recovery 1` JSON (attach to ticket) to use as the worst-case fixture and validate the estimate ≥ real ~4 min.
- Confirm `commandQueue` behaviour on a rejected command — does a late device reply leak into the next command? If so, add a generation/epoch guard in the handler.

## Docs note (re: your question)

The MultispeQ v2.0 instrument page is **hardware specs only** — no protocol or
timing semantics. Timing (`pulse_distance` in µs, `pulses` count, `pre_illumination`,
`set_repeats`, `v_arrays`) comes from the Protocols/Macros/Developers sections, and
**the device does not report a protocol's expected duration** — hence it must be
estimated client-side. The console page only confirms the `-1+` cancel switch.
