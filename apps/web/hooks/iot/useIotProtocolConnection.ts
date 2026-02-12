"use client";

import { useCallback, useState } from "react";

import type { SensorFamily } from "@repo/api";
import type { IDeviceProtocol } from "@repo/iot";
import {
  GenericDeviceProtocol,
  GENERIC_BLE_UUIDS,
  GENERIC_SERIAL_DEFAULTS,
  MultispeqProtocol,
  MULTISPEQ_BLE_UUIDS,
} from "@repo/iot";
import { WebBluetoothAdapter, WebSerialAdapter } from "@repo/iot/transport/web";

interface DeviceInfo {
  device_name?: string;
  device_battery?: number;
  device_version?: string;
  device_id?: string;
}

export function useIotProtocolConnection(
  sensorFamily: SensorFamily,
  connectionType: "bluetooth" | "serial" = "bluetooth",
) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [protocol, setProtocol] = useState<IDeviceProtocol | null>(null);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      let adapter;

      // Create adapter based on connection type
      if (connectionType === "bluetooth") {
        // Bluetooth connection
        const uuids = sensorFamily === "multispeq" ? MULTISPEQ_BLE_UUIDS : GENERIC_BLE_UUIDS;
        adapter = await WebBluetoothAdapter.requestAndConnect({
          serviceUUID: uuids.SERVICE,
          writeUUID: uuids.WRITE,
          notifyUUID: uuids.NOTIFY,
        });
      } else {
        // Serial connection
        if (!("serial" in navigator)) {
          throw new Error("Web Serial API not supported");
        }

        interface SerialPort {
          open(options: typeof GENERIC_SERIAL_DEFAULTS): Promise<void>;
        }

        interface NavigatorSerial {
          requestPort(): Promise<SerialPort>;
        }

        const port = await (
          navigator as unknown as { serial: NavigatorSerial }
        ).serial.requestPort();
        await port.open(GENERIC_SERIAL_DEFAULTS);
        adapter = new WebSerialAdapter(port as never);
      }

      // Initialize protocol based on sensor family
      if (sensorFamily === "multispeq") {
        const multispeqProtocol = new MultispeqProtocol();
        multispeqProtocol.initialize(adapter);
        setProtocol(multispeqProtocol);

        // Get device info
        try {
          const info = await multispeqProtocol.getDeviceInfo();
          setDeviceInfo(info as DeviceInfo);
        } catch (err) {
          console.warn("Could not get device info:", err);
        }
      } else {
        // Generic or Ambit devices
        const genericProtocol = new GenericDeviceProtocol();
        genericProtocol.initialize(adapter);
        setProtocol(genericProtocol);

        // Get device info
        try {
          const info = await genericProtocol.getDeviceInfo();
          setDeviceInfo(info as DeviceInfo);
        } catch (err) {
          console.warn("Could not get device info:", err);
        }
      }

      setIsConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to device");
      console.error("Connection error:", err);
    } finally {
      setIsConnecting(false);
    }
  }, [sensorFamily, connectionType]);

  const disconnect = useCallback(async () => {
    if (protocol) {
      try {
        await protocol.destroy();
      } catch (err) {
        console.error("Disconnect error:", err);
      }
      setProtocol(null);
      setDeviceInfo(null);
    }
    setIsConnected(false);
    setError(null);
  }, [protocol]);

  const executeProtocol = useCallback(
    async (protocolCode: Record<string, unknown>[]) => {
      if (!protocol || !isConnected) {
        throw new Error("Not connected to device");
      }

      // Execute each command in the protocol code array
      const results = [];
      for (const command of protocolCode) {
        const result = await protocol.execute(command);
        if (!result.success) {
          throw new Error(result.error?.message ?? "Protocol execution failed");
        }
        results.push(result.data);
      }

      return results;
    },
    [protocol, isConnected],
  );

  return {
    isConnected,
    isConnecting,
    error,
    deviceInfo,
    connect,
    disconnect,
    executeProtocol,
  };
}
