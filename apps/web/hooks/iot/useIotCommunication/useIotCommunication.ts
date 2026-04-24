"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { SensorFamily } from "@repo/api/schemas/protocol.schema";
import type { IDeviceDriver, ITransportAdapter } from "@repo/iot";
import {
  GenericDeviceDriver,
  GENERIC_BLE_UUIDS,
  GENERIC_SERIAL_DEFAULTS,
  MultispeqDriver,
  MULTISPEQ_SERIAL_DEFAULTS,
  isTransportSupported,
} from "@repo/iot";
import { WebBluetoothAdapter, WebSerialAdapter } from "@repo/iot/transport/web";

import { sensorFamilyToDeviceType } from "../device-type-mapping";

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
  const deviceType = sensorFamilyToDeviceType(sensorFamily);

  // Check transport support at the driver level
  if (!isTransportSupported(deviceType, connectionType)) {
    throw new Error(
      `${sensorFamily} does not support ${connectionType} transport. ` +
        (connectionType === "bluetooth"
          ? "This device uses Bluetooth Classic which is not available via Web Bluetooth (BLE-only). Use a serial connection instead."
          : "Use a Bluetooth connection instead."),
    );
  }

  if (connectionType === "bluetooth") {
    return WebBluetoothAdapter.requestAndConnect({
      serviceUUID: GENERIC_BLE_UUIDS.SERVICE,
      writeUUID: GENERIC_BLE_UUIDS.WRITE,
      notifyUUID: GENERIC_BLE_UUIDS.NOTIFY,
    });
  }

  // Serial — use device-specific defaults
  const serialDefaults =
    sensorFamily === "multispeq" ? MULTISPEQ_SERIAL_DEFAULTS : GENERIC_SERIAL_DEFAULTS;
  return WebSerialAdapter.requestAndConnect(serialDefaults);
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
  const adapterRef = useRef<ITransportAdapter | null>(null);

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

      // Listen for device disconnect events from the transport
      adapter.onStatusChanged((connected, err) => {
        if (!connected) {
          console.debug("[IoT] Device disconnected", err);
          setIsConnected(false);
          setDriver(null);
          setDeviceInfo(null);
          setError(err ? err.message : "Device disconnected");
          driverRef.current = null;
          adapterRef.current = null;
        }
      });

      adapterRef.current = adapter;
      setDriver(newDriver);
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
