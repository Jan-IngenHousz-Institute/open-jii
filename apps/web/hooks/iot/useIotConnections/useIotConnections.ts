"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MockTransportAdapter } from "~/lib/iot/mock-devices";

import type { SensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import type { IDeviceDriver, ITransportAdapter } from "@repo/iot";

import { createAdapter, createDriver } from "../useIotCommunication/useIotCommunication";

export type WorkbookConnectionType = "bluetooth" | "serial" | "mock";

export interface IotDeviceConnection {
  /** Stable per-connection id (uuid); devices carry no usable web identifier. */
  id: string;
  /** "Device #N" by connect order; mock devices name themselves. */
  label: string;
  /** Family captured at connect time; a later family switch must not retarget live drivers. */
  family: SensorFamily;
  driver: IDeviceDriver;
}

/**
 * Device registry for the workbook host: N same-family devices connected at
 * once (a USB hub of sensors), each with its own driver. Connect order is
 * insertion order; the first entry is the primary device. Mirrors the mobile
 * scanner registry semantics.
 */
export function useIotConnections(sensorFamily: SensorFamily) {
  const [connections, setConnections] = useState<IotDeviceConnection[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;
  // Total devices ever connected; numbers labels so they never repeat.
  const connectCounterRef = useRef(0);
  // Bumped by disconnectAll so an in-flight connect() started before the
  // disconnect can't re-add its device afterwards.
  const generationRef = useRef(0);

  // Disconnect every driver on unmount.
  useEffect(() => {
    return () => {
      for (const c of connectionsRef.current) {
        c.driver.destroy().catch((err: unknown) => console.error("Cleanup disconnect error:", err));
      }
    };
  }, []);

  const removeConnection = useCallback((id: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const connect = useCallback(
    async (connectionType: WorkbookConnectionType) => {
      setIsConnecting(true);
      setError(null);

      const generation = generationRef.current;
      let adapter: ITransportAdapter | undefined;
      try {
        const index = connectCounterRef.current + 1;
        adapter =
          connectionType === "mock"
            ? new MockTransportAdapter(index)
            : await createAdapter(sensorFamily, connectionType);

        const driver = createDriver(sensorFamily);
        await driver.initialize(adapter);

        // The user disconnected everything while this connect was in flight;
        // honor that instead of resurrecting a connection.
        if (generation !== generationRef.current) {
          await driver.destroy();
          return;
        }

        const id = crypto.randomUUID();
        const label = connectionType === "mock" ? `Mock MultispeQ ${index}` : `Device #${index}`;

        // Unplug/power-off: drop exactly this device; the others keep running.
        adapter.onStatusChanged((connected) => {
          if (!connected) removeConnection(id);
        });

        connectCounterRef.current = index;
        setConnections((prev) => [...prev, { id, label, family: sensorFamily, driver }]);
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        await adapter?.disconnect().catch(() => {});
        setError(err instanceof Error ? err.message : "Failed to connect to device");
        console.error("Connection error:", err);
      } finally {
        setIsConnecting(false);
      }
    },
    [sensorFamily, removeConnection],
  );

  const disconnectDevice = useCallback(
    async (id: string) => {
      const connection = connectionsRef.current.find((c) => c.id === id);
      if (!connection) return;
      removeConnection(id);
      try {
        await connection.driver.destroy();
      } catch (err) {
        console.error("Disconnect error:", err);
      }
    },
    [removeConnection],
  );

  const disconnectAll = useCallback(async () => {
    generationRef.current += 1;
    const existing = connectionsRef.current;
    setConnections([]);
    setError(null);
    await Promise.allSettled(existing.map((c) => c.driver.destroy()));
  }, []);

  return {
    connections,
    isConnecting,
    error,
    connect,
    disconnectDevice,
    disconnectAll,
  };
}
