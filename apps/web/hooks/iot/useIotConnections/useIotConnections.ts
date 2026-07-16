"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MockTransportAdapter, parseMockFamilies } from "~/lib/iot/mock-devices";

import type { SensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import type { DeviceIdentity, IDeviceDriver, ITransportAdapter } from "@repo/iot";
import { identifyDevice } from "@repo/iot";
import { toast } from "@repo/ui/hooks/use-toast";

import { createAdapter } from "../useIotCommunication/useIotCommunication";

export type WorkbookConnectionType = "bluetooth" | "serial" | "mock";

export interface IotDeviceConnection {
  /** Stable per-connection id (uuid); devices carry no usable web identifier. */
  id: string;
  /** Device-reported name when the handshake resolved one, else "Device #N". */
  label: string;
  /**
   * Family resolved by the post-connect identification handshake. The
   * handshake outranks the toolbar selection: what answered the probe is
   * what we are talking to.
   */
  family: SensorFamily;
  /** Structured identity from the handshake (name, id, firmware, battery). */
  identity: DeviceIdentity;
  driver: IDeviceDriver;
}

/**
 * Device registry for the workbook host: N devices connected at once (a USB
 * hub of sensors), each identified by a post-connect handshake and driving
 * its own connector. Connect order is insertion order; the first entry is
 * the primary device. Mirrors the mobile scanner registry semantics.
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
        if (connectionType === "mock") {
          // Successive connect clicks cycle through the ?mockDevices= families.
          const families = parseMockFamilies();
          adapter = new MockTransportAdapter(index, families[(index - 1) % families.length]);
        } else {
          adapter = await createAdapter(sensorFamily, connectionType);
        }

        // Identification handshake: probe who actually answered, and let that
        // outrank the toolbar family.
        const { family, info, connector } = await identifyDevice(adapter, {
          probeTimeoutMs: 2000,
        });

        // The user disconnected everything while this connect was in flight;
        // honor that instead of resurrecting a connection.
        if (generation !== generationRef.current) {
          await connector.destroy();
          return;
        }

        if (family !== sensorFamily) {
          toast({
            title: "Different device identified",
            description: `Connected as ${sensorFamily}, but the device identifies as ${family}. Using ${family}.`,
          });
        }

        const id = crypto.randomUUID();
        const label = info.name ?? `Device #${index}`;

        // Unplug/power-off: drop exactly this device; the others keep running.
        adapter.onStatusChanged((connected) => {
          if (!connected) removeConnection(id);
        });

        connectCounterRef.current = index;
        setConnections((prev) => [
          ...prev,
          { id, label, family, identity: info, driver: connector },
        ]);
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
