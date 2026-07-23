import type { SensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import type { DeviceType } from "@repo/iot";

/**
 * Conformance-only declarative catalog of each API family's current local
 * execution state per host. This is verification data owned by the nomenclature
 * tooling: host applications do not import it at runtime. Tickets 3 (mobile) and
 * 4 (web) assert their dispatch conforms to it; they do not redefine it.
 *
 * Current host state is one of three values. Planned product-specific
 * integration is recorded separately in `plannedSpecificIntegration` and must
 * never be consumed as runtime availability.
 */
export type HostSupportState =
  /** A product-specific driver is current; its implemented channels may show. */
  | "current-specific"
  /** The host routes the product through the generic driver today. */
  | "current-generic-compatibility"
  /** The host has no current local execution path for the product. */
  | "unavailable";

export type HostKey = "web" | "mobile";

/**
 * Precise conformance channel. Unlike IoT's intentionally coarse
 * `TransportCategory` (`"bluetooth"` means Web BLE, RN BLE, or RN Bluetooth
 * Classic), these distinguish Bluetooth Classic from BLE so the catalog can
 * record (and the conformance tests can verify) that mobile MultiSpeQ is
 * Classic, not BLE.
 */
export type ConformanceChannel = "bluetooth-classic" | "ble" | "usb-serial";

export interface HostFamilySupport {
  state: HostSupportState;
  /**
   * IoT `DeviceType` the host routes this family to when it has a current local
   * path; `null` when `unavailable`.
   */
  deviceType: DeviceType | null;
  /**
   * Precise channels the host currently exposes for this family. Channel
   * support is NOT owned here: the conformance tests derive the expected set
   * from the IoT driver's `supportedTransports`, `supportsBLE`, and
   * `supportsBluetoothClassic` flags (web maps BLE-only Web Bluetooth; mobile
   * maps RN Bluetooth Classic + BLE + USB), so the catalog never becomes an
   * independent channel authority. Empty when `unavailable`.
   */
  transports: readonly ConformanceChannel[];
  /**
   * Roadmap-only annotation. Documenting a planned product-specific integration
   * here never replaces or upgrades the current `state` and is not runtime
   * availability.
   */
  plannedSpecificIntegration?: string;
  rationale: string;
}

const web: Record<SensorFamily, HostFamilySupport> = {
  multispeq: {
    state: "current-specific",
    deviceType: "multispeq",
    transports: ["usb-serial"],
    rationale:
      "Web drives MultiSpeQ through the MultiSpeQ driver over USB/serial only; MultiSpeQ is Bluetooth Classic, which Web Bluetooth cannot access.",
  },
  ambit: {
    state: "current-specific",
    deviceType: "ambit",
    transports: ["usb-serial"],
    rationale: "Web drives Ambit through AmbitDriver over its current serial-only transport.",
  },
  minipar: {
    state: "current-specific",
    deviceType: "minipar",
    transports: ["usb-serial"],
    rationale: "Web drives MiniPAR through MiniParDriver over its current serial-only transport.",
  },
  generic: {
    state: "current-specific",
    deviceType: "generic",
    transports: ["ble", "usb-serial"],
    rationale:
      "The generic driver is the current implementation for the generic family and exposes BLE and USB/serial.",
  },
  ambyte: {
    state: "current-generic-compatibility",
    deviceType: "generic",
    transports: ["ble", "usb-serial"],
    plannedSpecificIntegration:
      "A dedicated Ambyte BLE integration is planned separately and is not a current capability.",
    rationale:
      "Web currently routes the Ambyte family through the generic driver (BLE and USB/serial); this is a compatibility route, not a dedicated Ambyte integration.",
  },
};

const mobile: Record<SensorFamily, HostFamilySupport> = {
  multispeq: {
    state: "current-specific",
    deviceType: "multispeq",
    // Mobile's current MultiSpeQ executor uses Bluetooth Classic and USB/serial,
    // never BLE. The conformance test derives this from the IoT driver's
    // supportsBluetoothClassic / supportsBLE / serial flags.
    transports: ["bluetooth-classic", "usb-serial"],
    rationale:
      "Mobile drives MultiSpeQ through the current MultiSpeQ executor over Bluetooth Classic and USB/serial.",
  },
  ambit: {
    state: "unavailable",
    deviceType: null,
    transports: [],
    rationale: "Mobile has no current family-aware local execution path for Ambit.",
  },
  minipar: {
    state: "unavailable",
    deviceType: null,
    transports: [],
    rationale: "Mobile has no current family-aware local execution path for MiniPAR.",
  },
  generic: {
    state: "unavailable",
    deviceType: null,
    transports: [],
    rationale: "Mobile has no current family-aware local execution path for the generic family.",
  },
  ambyte: {
    state: "unavailable",
    deviceType: null,
    transports: [],
    plannedSpecificIntegration:
      "A dedicated Ambyte BLE integration is planned separately and is not a current capability.",
    rationale:
      "Mobile has no current local execution path for Ambyte; a dedicated integration remains planned.",
  },
};

export const HOST_SUPPORT_CATALOG: Record<HostKey, Record<SensorFamily, HostFamilySupport>> = {
  web,
  mobile,
};

export const SUPPORT_HOSTS: readonly HostKey[] = ["web", "mobile"];
