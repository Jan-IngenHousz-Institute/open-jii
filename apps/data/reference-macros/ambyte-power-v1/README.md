# Ambyte power projection v1

This reference extends a telemetry macro without changing any stored macro or
experiment. `macro.js` defines `projectAmbytePower(json)` for a normalized
`ambyte.telemetry/1` measurement. `schema.json` describes its nullable Spark output
columns. The existing macro host normalizes a legacy `{ sample: [entry] }`
envelope before running macro code. A direct root array remains an array and is
not implicitly reduced by this projection.

The power fields keep raw reported values, including zero. Use `power_valid`
alongside the voltage. A zero VBAT does not establish that a battery is absent,
and a firmware validity flag does not prove a new ADC conversion. VSYS is the
system rail, not the battery. Protection restricts measurement work and does not
establish that charging is inhibited. Missing counters are null, never inferred
as zero. `power_protect_since_utc` is Unix seconds, not milliseconds.

## Separate live update

This reference is not installed by the application or a bundle deployment. A live
experiment macro still needs a separate, user-approved update. Preserve every
existing output column and its meaning. Copy the `projectAmbytePower` function
into the existing macro, then add this block immediately before its existing
`return result`, using that macro's output variable in place of `result`:

```js
const protection = projectAmbytePower(json);
Object.assign(result, {
  power_protect_state: protection.power_protect_state,
  power_protect_reason: protection.power_protect_reason,
  power_protect_since_utc: protection.power_protect_since_utc,
  power_protect_skipped_flash_runs: protection.power_protect_skipped_flash_runs,
  power_protect_skipped_ambit_runs: protection.power_protect_skipped_ambit_runs,
  power_protect_skipped_ota: protection.power_protect_skipped_ota,
});
```

Add the six `power_protect_*` fields from `schema.json` to any explicit output
schema. Leave the existing power fields and all unrelated fields unchanged.
Test against `fixtures.json` before submitting a live update. The fixtures are
synthetic and include missing power, older firmware without protection, zero
VBAT with positive VSYS, and `no_flash` while charging.

The device monitoring API reads the stored telemetry directly and does not
depend on this live macro update. Experiment charts that use macro output will
only gain protection columns after that separate update and processing. Existing
saved charts and reports are not rewritten by this change.

## Validation

From the repository root:

```sh
pnpm --filter @repo/api exec vitest run src/transforms/ambyte-power.spec.ts
```

This runs the real input normalizer, the reference projection, JSON serialization,
the monitoring extractor and the API response schema on the same fixtures.
