"use client";

import type { ReactNode } from "react";
import type { TransportUnavailableReason } from "~/hooks/iot/useIotBrowserSupport";

import type { SensorFamily } from "@repo/api/domains/protocol/protocol.schema";

import { ConnectionTypeSelector } from "./iot-connection-type-selector";
import { DeviceStatusCard } from "./iot-device-status-card";

interface DeviceInfo {
  device_name?: string;
  device_battery?: number;
  device_version?: string;
  device_id?: string;
}

interface ConnectionModuleProps {
  connectionType: "bluetooth" | "serial";
  onConnectionTypeChange: (type: "bluetooth" | "serial") => void;
  browserSupport: {
    bluetooth: boolean;
    serial: boolean;
    bluetoothReason: TransportUnavailableReason;
    serialReason: TransportUnavailableReason;
  };
  bluetoothClassicOnly?: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  deviceInfo: DeviceInfo | null;
  sensorFamily?: SensorFamily;
  onConnect: () => void;
  onDisconnect: () => void;
  /** Module-specific primary once connected: Run protocol, Push configuration. */
  action?: ReactNode;
  /** The register stitch: shown when the caller decides the device is unmatched. */
  registerAction?: ReactNode;
}

/**
 * The one connection UI. Its rule over the pieces it composes: the transport
 * row never disappears on connect, it locks with the active pipe selected, so
 * the user always sees which one they are on.
 */
export function ConnectionModule({
  connectionType,
  onConnectionTypeChange,
  browserSupport,
  bluetoothClassicOnly,
  isConnected,
  isConnecting,
  error,
  deviceInfo,
  sensorFamily,
  onConnect,
  onDisconnect,
  action,
  registerAction,
}: ConnectionModuleProps) {
  return (
    <div className="space-y-4">
      <ConnectionTypeSelector
        connectionType={connectionType}
        onConnectionTypeChange={onConnectionTypeChange}
        browserSupport={browserSupport}
        bluetoothClassicOnly={bluetoothClassicOnly}
        disabled={isConnected || isConnecting}
      />

      <DeviceStatusCard
        isConnected={isConnected}
        isConnecting={isConnecting}
        error={error}
        deviceInfo={deviceInfo}
        connectionType={connectionType}
        sensorFamily={sensorFamily}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
      />

      {isConnected && action}
      {isConnected && registerAction}
    </div>
  );
}
