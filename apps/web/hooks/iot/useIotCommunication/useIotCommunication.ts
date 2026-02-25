"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { SensorFamily } from "@repo/api";
import type { IDeviceProtocol, ITransportAdapter } from "@repo/iot";
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

export function useIotCommunication(
  sensorFamily: SensorFamily,
  connectionType: "bluetooth" | "serial" = "bluetooth",
) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [protocol, setProtocol] = useState<IDeviceProtocol | null>(null);
  const protocolRef = useRef<IDeviceProtocol | null>(null);

  // Keep ref in sync so the cleanup effect always has the latest protocol
  useEffect(() => {
    protocolRef.current = protocol;
  }, [protocol]);

  // Disconnect on unmount (navigating away)
  useEffect(() => {
    return () => {
      const p = protocolRef.current;
      if (p) {
        p.destroy().catch((err) => console.error("Cleanup disconnect error:", err));
      }
    };
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    let adapter: ITransportAdapter | undefined;

    try {
      // Create adapter based on connection type
      if (connectionType === "bluetooth") {
        // Bluetooth connection
        const uuids = sensorFamily === "multispeq" ? MULTISPEQ_BLE_UUIDS : GENERIC_BLE_UUIDS;
        console.log(
          "[useIotCommunication] Connecting via Bluetooth, sensorFamily:",
          sensorFamily,
          "uuids:",
          uuids,
        );
        adapter = await WebBluetoothAdapter.requestAndConnect({
          serviceUUID: uuids.SERVICE,
          writeUUID: uuids.WRITE,
          notifyUUID: uuids.NOTIFY,
        });
        console.log("[useIotCommunication] Bluetooth adapter connected");
      } else {
        // Serial connection
        console.log("[useIotCommunication] Connecting via Serial, sensorFamily:", sensorFamily);
        adapter = await WebSerialAdapter.requestAndConnect(GENERIC_SERIAL_DEFAULTS);
        console.log("[useIotCommunication] Serial adapter connected");
      }

      // Initialize protocol based on sensor family
      if (sensorFamily === "multispeq") {
        console.log("[useIotCommunication] Initializing MultispeQ protocol");
        const multispeqProtocol = new MultispeqProtocol();
        multispeqProtocol.initialize(adapter);
        setProtocol(multispeqProtocol);

        console.log("[useIotCommunication] Fetching MultispeQ device info...");
        const info = await multispeqProtocol.getDeviceInfo();
        console.log("[useIotCommunication] MultispeQ device info:", info);
        setDeviceInfo(info as DeviceInfo);
      } else {
        // Generic or Ambit devices
        console.log("[useIotCommunication] Initializing Generic protocol");
        const genericProtocol = new GenericDeviceProtocol();
        genericProtocol.initialize(adapter);
        setProtocol(genericProtocol);

        console.log("[useIotCommunication] Fetching Generic device info...");
        const info = await genericProtocol.getDeviceInfo();
        console.log("[useIotCommunication] Generic device info:", info);
        setDeviceInfo(info as DeviceInfo);
      }

      setIsConnected(true);
      console.log("[useIotCommunication] Connection complete, isConnected: true");
    } catch (err) {
      console.error("[useIotCommunication] Connection error:", err);
      // Clean up the adapter/port so the port is released for retry
      if (adapter) {
        try {
          await adapter.disconnect();
        } catch {
          // Ignore cleanup errors
        }
      }
      setProtocol(null);
      setDeviceInfo(null);
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

  return {
    isConnected,
    isConnecting,
    error,
    deviceInfo,
    protocol,
    connect,
    disconnect,
  };
}
