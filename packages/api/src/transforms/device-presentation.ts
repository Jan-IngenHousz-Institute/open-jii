import type { DisplayRole } from "../domains/device/device-profile";
import {
  isDisplayRole,
  resolveDeviceProfile,
  UNKNOWN_DEVICE,
} from "../domains/device/device-profile";

/**
 * Structural device-presentation transform. Like the neighbouring
 * `device-context` transform it is domain-pure: it accepts a shape-compatible
 * input rather than importing any host or @repo/iot type, and it returns
 * structural presentation data rather than rendered copy. Hosts translate the
 * role identifiers and the `unknown-device` token and supply their own product
 * trademarks from the canonical profile spelling.
 */

/** Shape-compatible input; every field is optional structural data. */
export interface DevicePresentationInput {
  /** User-assigned, transport-reported, or device-reported name. */
  name?: string | null;
  /** Raw family/product identifier; narrowed through the profile map. */
  family?: string | null;
  /**
   * Contextual role identifiers supplied by the host. Typed to known
   * `DisplayRole` tokens; untyped runtime values are filtered out.
   */
  roles?: readonly DisplayRole[];
  /** Stable identifier for secondary/fallback display. */
  id?: string | null;
}

/** Where the `primary` value came from. */
export type DevicePresentationProvenance = "name" | "product" | "fallback";

export interface DevicePresentation {
  /** Named value, canonical product name, or the `unknown-device` token. */
  primary: string;
  /** Provenance of {@link DevicePresentation.primary}. */
  provenance: DevicePresentationProvenance;
  /** Stable product identifier when the family is a known product, else `null`. */
  productId: string | null;
  /** Canonical product name when the family is a known product, else `null`. */
  productName: string | null;
  /**
   * Known display-role identifiers for secondary context (profile defaults or
   * host-supplied). A frozen, defensively copied collection: mutating it never
   * affects canonical profiles or subsequent calls.
   */
  roles: readonly DisplayRole[];
  /** Stable identifier for secondary/fallback display, or `null`. */
  id: string | null;
}

function usable(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Deduplicate and validate contextual roles. Untyped runtime input (a plain JS
 * caller) may carry arbitrary or non-string values; only known `DisplayRole`
 * tokens survive, so invalid roles never escape the shared contract.
 */
function normalizeRoles(values: readonly DisplayRole[]): DisplayRole[] {
  const seen = new Set<DisplayRole>();
  for (const value of values) {
    const token = typeof value === "string" ? value.trim() : value;
    if (isDisplayRole(token)) seen.add(token);
  }
  return [...seen];
}

/**
 * Resolve the deterministic identity hierarchy:
 *
 * 1. a usable assigned/reported name wins;
 * 2. otherwise a known product profile's canonical name;
 * 3. otherwise the `unknown-device` fallback token.
 *
 * The generic family and unknown/foreign values both fall through to the
 * fallback token, because neither carries a product name.
 */
export function presentDevice(input: DevicePresentationInput): DevicePresentation {
  const profile = resolveDeviceProfile(input.family);
  const contextualRoles = input.roles ? normalizeRoles(input.roles) : [];
  // Always a fresh frozen copy so callers cannot mutate canonical profile roles
  // or one presentation's roles and corrupt a later call.
  const roles: readonly DisplayRole[] = Object.freeze([
    ...(contextualRoles.length > 0 ? contextualRoles : (profile?.roles ?? [])),
  ]);
  const id = usable(input.id);

  const name = usable(input.name);
  if (name !== null) {
    return {
      primary: name,
      provenance: "name",
      productId: profile?.productId ?? null,
      productName: profile?.productName ?? null,
      roles,
      id,
    };
  }

  if (profile?.productName != null) {
    return {
      primary: profile.productName,
      provenance: "product",
      productId: profile.productId,
      productName: profile.productName,
      roles,
      id,
    };
  }

  return {
    primary: UNKNOWN_DEVICE,
    provenance: "fallback",
    productId: null,
    productName: null,
    roles,
    id,
  };
}
