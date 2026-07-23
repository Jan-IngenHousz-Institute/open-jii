/**
 * Load-bearing family used only while the identity handshake is pending or
 * unavailable. Mobile currently executes MultispeQ hardware only; changing
 * this value requires a separate device-support initiative.
 */
export const MOBILE_PRE_IDENTITY_FAMILY = "multispeq" as const;
