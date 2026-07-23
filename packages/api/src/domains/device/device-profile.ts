import type { SensorFamily } from "../protocol/protocol.schema";

/**
 * Domain-pure product/role presentation contract for the platform's device
 * families. This module owns canonical product spelling and display-role
 * identifiers only. It carries no channel availability, driver constructor,
 * credential state, host context, or translated prose: transport and
 * commandability come from the host/@repo/iot boundary, and copy comes from
 * each host's i18n layer. It imports no IoT, database, UI, or i18n code.
 *
 * The canonical data is frozen at runtime (map, each profile, and each nested
 * role array) so exported references cannot mutate global presentation state.
 */

/** Structural token a host translates when neither name nor product is known. */
export const UNKNOWN_DEVICE = "unknown-device";

/**
 * Known display-role identifiers. These are structural presentation defaults
 * that a host translates; they are not an exhaustive capability model. Frozen at
 * runtime so a caller cannot push a new token into the validation authority and
 * re-authorize an arbitrary role through {@link isDisplayRole}.
 */
export const DISPLAY_ROLES = Object.freeze(["measurement-device", "gateway"] as const);

export type DisplayRole = (typeof DISPLAY_ROLES)[number];

/** Runtime guard: narrow untyped input to a known translatable display role. */
export function isDisplayRole(value: unknown): value is DisplayRole {
  return typeof value === "string" && (DISPLAY_ROLES as readonly string[]).includes(value);
}

export interface DeviceProfile {
  /**
   * Stable, translation-free identifier for the product profile. `null` for the
   * generic family, which has no product identity.
   */
  readonly productId: string | null;
  /**
   * Canonical product spelling used for display (a product trademark such as
   * `MultispeQ`). `null` for the generic family, which has no fabricated name.
   */
  readonly productName: string | null;
  /**
   * Default display-role identifiers. A host may select or override the
   * contextual role at presentation time.
   */
  readonly roles: readonly DisplayRole[];
}

function freezeProfile(profile: DeviceProfile): DeviceProfile {
  Object.freeze(profile.roles);
  return Object.freeze(profile);
}

/**
 * Exhaustive profile record keyed by API `SensorFamily`. The `Record` type makes
 * exhaustiveness a compile-time invariant: a new family cannot be added to
 * `zSensorFamily` without a profile here. `generic` intentionally carries no
 * product name or role. The map and its contents are frozen at runtime.
 */
export const DEVICE_PROFILES: Readonly<Record<SensorFamily, DeviceProfile>> = Object.freeze({
  multispeq: freezeProfile({
    productId: "multispeq",
    productName: "MultispeQ",
    roles: ["measurement-device"],
  }),
  ambit: freezeProfile({
    productId: "ambit",
    productName: "Ambit",
    roles: ["measurement-device"],
  }),
  minipar: freezeProfile({
    productId: "minipar",
    productName: "MiniPAR",
    roles: ["measurement-device"],
  }),
  ambyte: freezeProfile({
    productId: "ambyte",
    productName: "Ambyte",
    roles: ["gateway"],
  }),
  generic: freezeProfile({
    productId: null,
    productName: null,
    roles: [],
  }),
});

/**
 * Narrow a raw family string through the profile map. A known family resolves
 * to its (frozen) profile (including `generic`, which is a known family with no
 * product name); an unknown or foreign value resolves to `null` so the caller
 * can fall back to {@link UNKNOWN_DEVICE} rather than fabricate a missing
 * profile.
 */
export function resolveDeviceProfile(family: string | null | undefined): DeviceProfile | null {
  if (typeof family === "string" && Object.prototype.hasOwnProperty.call(DEVICE_PROFILES, family)) {
    return DEVICE_PROFILES[family as SensorFamily];
  }
  return null;
}
