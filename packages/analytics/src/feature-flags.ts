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
};
