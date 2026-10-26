"use client";

import { useMemo, useSyncExternalStore } from "react";

import type { SensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import { isTransportSupported } from "@repo/iot";

import { sensorFamilyToDeviceType } from "./device-type-mapping";

const subscribe = () => () => undefined;

/** Why a transport is unavailable */
export type TransportUnavailableReason = "browser" | "device" | null;

export interface IotBrowserSupport {
  bluetooth: boolean;
  serial: boolean;
  /** True if at least one of bluetooth or serial is supported */
  any: boolean;
  /** Why bluetooth is unavailable (null when available) */
  bluetoothReason: TransportUnavailableReason;
  /** Why serial is unavailable (null when available) */
  serialReason: TransportUnavailableReason;
}

/**
 * Detects browser transport support, filtered by device capabilities.
 *
 * For example, MultispeQ only supports Bluetooth Classic (no BLE), so
 * `bluetooth` will be `false` on the web even if the browser has Web Bluetooth,
 * because Web Bluetooth is BLE-only.
 *
 * @param sensorFamily - Optional sensor family. When provided, results are
 *   intersected with the device's declared transport support.
 */
export function useIotBrowserSupport(sensorFamily?: SensorFamily): IotBrowserSupport {
  const browserBluetooth = useSyncExternalStore(
    subscribe,
    () => typeof navigator !== "undefined" && "bluetooth" in navigator,
    () => false,
  );
  const browserSerial = useSyncExternalStore(
    subscribe,
    () => typeof navigator !== "undefined" && "serial" in navigator,
    () => false,
  );

  return useMemo(() => {
    // Intersect browser capabilities with device transport support
    const deviceType = sensorFamily ? sensorFamilyToDeviceType(sensorFamily) : undefined;
    const deviceSupportsBluetooth = deviceType
      ? isTransportSupported(deviceType, "bluetooth")
      : true;
    const deviceSupportsSerial = deviceType ? isTransportSupported(deviceType, "serial") : true;

    const bluetooth = browserBluetooth && deviceSupportsBluetooth;
    const serial = browserSerial && deviceSupportsSerial;

    const bluetoothReason: TransportUnavailableReason = bluetooth
      ? null
      : !browserBluetooth
        ? "browser"
        : "device";
    const serialReason: TransportUnavailableReason = serial
      ? null
      : !browserSerial
        ? "browser"
        : "device";

    return { bluetooth, serial, any: bluetooth || serial, bluetoothReason, serialReason };
  }, [browserBluetooth, browserSerial, sensorFamily]);
}
