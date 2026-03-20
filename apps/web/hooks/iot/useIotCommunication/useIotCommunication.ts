"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { SensorFamily } from "@repo/api";
import type { IDeviceDriver, ITransportAdapter } from "@repo/iot";
import {
  GenericDeviceDriver,
  GENERIC_BLE_UUIDS,
  GENERIC_SERIAL_DEFAULTS,
  MultispeqDriver,
  MULTISPEQ_SERIAL_DEFAULTS,
} from "@repo/iot";
import { WebBluetoothAdapter, WebSerialAdapter } from "@repo/iot/transport/web";

type ConnectionType = "bluetooth" | "serial";

interface DeviceInfo {
  device_name?: string;
  device_battery?: number;
  device_version?: string;
  device_id?: string;
}

async function createAdapter(
  sensorFamily: SensorFamily,
  connectionType: ConnectionType,
): Promise<ITransportAdapter> {
  if (sensorFamily === "multispeq") {
    // MultispeQ uses Bluetooth Classic + USB Serial — not BLE.
    // Web Bluetooth is BLE-only, so only serial works on the web.
    if (connectionType === "bluetooth") {
      throw new Error(
        "MultispeQ does not support Web Bluetooth (BLE). Use a serial connection instead.",
      );
    }
    return WebSerialAdapter.requestAndConnect(MULTISPEQ_SERIAL_DEFAULTS);
  }

  // Generic / Ambit — supports both BLE and serial
  if (connectionType === "bluetooth") {
    return WebBluetoothAdapter.requestAndConnect({
      serviceUUID: GENERIC_BLE_UUIDS.SERVICE,
      writeUUID: GENERIC_BLE_UUIDS.WRITE,
      notifyUUID: GENERIC_BLE_UUIDS.NOTIFY,
    });
  }

  return WebSerialAdapter.requestAndConnect(GENERIC_SERIAL_DEFAULTS);
}

function createDriver(sensorFamily: SensorFamily): IDeviceDriver {
  return sensorFamily === "multispeq" ? new MultispeqDriver() : new GenericDeviceDriver();
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useIotCommunication(
  sensorFamily: SensorFamily,
  connectionType: ConnectionType = "bluetooth",
) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [driver, setDriver] = useState<IDeviceDriver | null>(null);
  const driverRef = useRef<IDeviceDriver | null>(null);

  // Keep ref in sync so the unmount cleanup always sees the latest driver
  useEffect(() => {
    driverRef.current = driver;
  }, [driver]);

  // Disconnect on unmount
  useEffect(() => {
    return () => {
      driverRef.current
        ?.destroy()
        .catch((err: unknown) => console.error("Cleanup disconnect error:", err));
    };
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    let adapter: ITransportAdapter | undefined;

    try {
      adapter = await createAdapter(sensorFamily, connectionType);

      const newDriver = createDriver(sensorFamily);
      await newDriver.initialize(adapter);

      const info = await newDriver.getDeviceInfo?.();

      setDriver(newDriver);
      setDeviceInfo(info ? (info as DeviceInfo) : null);
      setIsConnected(true);
    } catch (err) {
      // Release the port/adapter so the user can retry
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      await adapter?.disconnect().catch(() => {});
      setDriver(null);
      setDeviceInfo(null);
      setError(err instanceof Error ? err.message : "Failed to connect to device");
      console.error("Connection error:", err);
    } finally {
      setIsConnecting(false);
    }
  }, [sensorFamily, connectionType]);

  const disconnect = useCallback(async () => {
    try {
      await driver?.destroy();
    } catch (err) {
      console.error("Disconnect error:", err);
    }
    setDriver(null);
    setDeviceInfo(null);
    setIsConnected(false);
    setError(null);
  }, [driver]);

  return {
    isConnected,
    isConnecting,
    error,
    deviceInfo,
    driver,
    connect,
    disconnect,
  };
}
