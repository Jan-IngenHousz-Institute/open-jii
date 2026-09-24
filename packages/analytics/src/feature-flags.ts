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
  // The PostHog key is the one that once hid the device registry; it was kept there when
  // the registry shipped and now hides device calibration instead.
  CALIBRATION: "iot-devices",
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
  [FEATURE_FLAGS.CALIBRATION]: false, // Hidden until targeted in PostHog
};

/**
 * Person properties sent with every flag evaluation for a signed-in user. PostHog evaluates with
 * them without storing them, so a condition on the email or an organization matches even before
 * the user has a PostHog person. "is any of" never matches a multi-valued property, so the
 * organization ids are one comma-joined string matched with "contains"; uuids are fixed length,
 * so one cannot match inside another.
 */
export function flagPersonProperties(user: { email: string; organizationIds: readonly string[] }): {
  email: string;
  organization_ids: string;
} {
  return { email: user.email, organization_ids: user.organizationIds.join(",") };
}
