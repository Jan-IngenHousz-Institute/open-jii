/**
 * Feature flag configuration
 * Defines all available feature flags and their default values
 */
export const FEATURE_FLAGS = {
  MULTI_LANGUAGE: "multi-language",
  PROTOCOL_VALIDATION_AS_WARNING: "protocol-validation-as-warning",
  PROTOCOL_DELETION: "protocol-deletion",
  EXPERIMENT_DELETION: "experiment-deletion",
  MACRO_DELETION: "macro-deletion",
  WORKBOOK_DELETION: "workbook-deletion",
  IOT_DEVICES: "iot-devices",
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

/**
 * Default values for feature flags when analytics service is unavailable
 * Use conservative defaults (features disabled) for safety
 */
export const FEATURE_FLAG_DEFAULTS: Record<FeatureFlagKey, boolean> = {
  [FEATURE_FLAGS.MULTI_LANGUAGE]: false, // Default to single language
  [FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING]: true, // Default to warnings enabled
  [FEATURE_FLAGS.PROTOCOL_DELETION]: false, // Default to disabled for safety
  [FEATURE_FLAGS.EXPERIMENT_DELETION]: false, // Default to disabled for safety
  [FEATURE_FLAGS.MACRO_DELETION]: false, // Default to disabled for safety
  [FEATURE_FLAGS.WORKBOOK_DELETION]: false, // Default to disabled for safety
  [FEATURE_FLAGS.IOT_DEVICES]: false, // Device registry & certificates hidden until released
};

/**
 * Local-dev escape hatch: `FEATURE_FLAGS_FORCE` (server) or
 * `NEXT_PUBLIC_FEATURE_FLAGS_FORCE` (web client, inlined at build) force flags
 * on before any PostHog evaluation. "all" or a comma-separated list of flag
 * keys. Never set in a deployed environment.
 */
export function isFlagForcedOn(flagKey: FeatureFlagKey): boolean {
  // Tests exercise the real evaluation logic; a developer's local force
  // switch must not leak into them.
  if (process.env.NODE_ENV === "test") {
    return false;
  }

  const raw = process.env.FEATURE_FLAGS_FORCE ?? process.env.NEXT_PUBLIC_FEATURE_FLAGS_FORCE;
  if (!raw) {
    return false;
  }
  if (raw === "all") {
    return true;
  }
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .includes(flagKey);
}
