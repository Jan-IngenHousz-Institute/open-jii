// Reference projection for a normalized single telemetry measurement.
function projectAmbytePower(entry) {
  const telemetry = entry && entry.schema === "ambyte.telemetry/1" ? entry : {};
  const health = telemetry.health || {};
  const power = health.power || {};
  const protection = health.power_protect || {};
  const skipped = protection.skipped || {};
  const number = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  const count = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);
  const string = (value) => (typeof value === "string" && value.length > 0 ? value : null);
  return {
    power_valid: typeof power.valid === "boolean" ? power.valid : null,
    power_reason: string(power.reason),
    power_battery_v: number(power.battery_v),
    power_system_v: number(power.system_v),
    power_charge_status: count(power.charge_status),
    power_charge_ma: number(power.charge_ma),
    power_protect_state: string(protection.state),
    power_protect_reason: string(protection.reason),
    power_protect_since_utc: count(protection.since_utc),
    power_protect_skipped_flash_runs: count(skipped.flash_runs),
    power_protect_skipped_ambit_runs: count(skipped.ambit_runs),
    power_protect_skipped_ota: count(skipped.ota),
  };
}
