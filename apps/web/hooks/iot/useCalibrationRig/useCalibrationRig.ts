"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  BenchInstrument,
  CaptureProcedure,
  IDeviceDriver,
  ITransportAdapter,
  RigBinding,
} from "@repo/iot";
import {
  DUT_ROLE,
  bindBenchInstrument,
  bindDeviceSetpoints,
  handshakeMatches,
  identifyBenchInstrument,
  requiredRoles,
  shutdownRig,
} from "@repo/iot";

import { openSerialPort } from "../useIotCommunication/useIotCommunication";

export type RigRoleStatus =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "connected"; model: string; reply: string }
  | { kind: "mismatch"; reply: string }
  | { kind: "unrecognised" }
  | { kind: "failed"; message: string };

export interface RigRole {
  role: string;
  handshake: string;
  /** A run aborts without it; an optional step's role is not one. */
  required: boolean;
  status: RigRoleStatus;
}

interface DeclaredRole {
  role: string;
  handshake: string;
  required: boolean;
}

interface ConnectedInstrument {
  instrument: BenchInstrument;
  transport: ITransportAdapter;
}

const IDLE: RigRoleStatus = { kind: "idle" };

async function releasePort(transport: ITransportAdapter | undefined): Promise<void> {
  await transport?.disconnect().catch(() => undefined);
}

/**
 * The bench around the device under test: a lamp supply and a reference sensor, each on a
 * serial port of its own, bound to the role its procedure declared by identity handshake.
 */
export function useCalibrationRig(
  procedure: CaptureProcedure | undefined,
  dut: IDeviceDriver | undefined,
): {
  roles: RigRole[];
  /** The rig as the interpreter takes it: the device under test plus every connected role. */
  bindings: Partial<Record<string, RigBinding>>;
  hasEveryRequiredRole: boolean;
  isConnecting: boolean;
  connectRole(role: string): Promise<void>;
  disconnectRole(role: string): Promise<void>;
  /** Return every connected instrument to a safe state, keeping the ports open for a retry. */
  rest(): Promise<void>;
  /** rest(), then close every port and forget them. */
  shutdownAll(): Promise<void>;
} {
  const [statuses, setStatuses] = useState<ReadonlyMap<string, RigRoleStatus>>(new Map());
  const [connected, setConnected] = useState<ReadonlyMap<string, ConnectedInstrument>>(new Map());
  const connectedRef = useRef(connected);
  connectedRef.current = connected;
  // Bumped by shutdownAll so a connect already in flight cannot bind its port afterwards.
  const generationRef = useRef(0);

  const declaredRoles = useMemo<DeclaredRole[]>(() => {
    if (!procedure) {
      return [];
    }

    const runNeeds = new Set(requiredRoles(procedure));

    return procedure.instruments.flatMap((instrument) =>
      instrument.role === DUT_ROLE || instrument.handshake === undefined
        ? []
        : [
            {
              role: instrument.role,
              handshake: instrument.handshake,
              required: runNeeds.has(instrument.role),
            },
          ],
    );
  }, [procedure]);

  const roles = useMemo<RigRole[]>(
    () =>
      declaredRoles.map((declared) => ({
        ...declared,
        status: statuses.get(declared.role) ?? IDLE,
      })),
    [declaredRoles, statuses],
  );

  // One binding per connected device, so resting it knows which setpoints the run drove.
  const dutSetpoint = useMemo(() => (dut ? bindDeviceSetpoints(dut) : undefined), [dut]);
  const dutSetpointRef = useRef(dutSetpoint);
  dutSetpointRef.current = dutSetpoint;

  const bindings = useMemo(() => {
    const rig: Partial<Record<string, RigBinding>> = {};

    if (dut) {
      rig[DUT_ROLE] = dutSetpoint ? { read: dut, setpoint: dutSetpoint } : { read: dut };
    }

    for (const [role, entry] of connected) {
      rig[role] = bindBenchInstrument(entry.instrument);
    }

    return rig;
  }, [connected, dut, dutSetpoint]);

  const isConnecting = roles.some((entry) => entry.status.kind === "connecting");
  const hasEveryRequiredRole = roles.every(
    (entry) => !entry.required || entry.status.kind === "connected",
  );

  const dropRole = useCallback((role: string) => {
    setConnected((previous) => {
      const next = new Map(previous);
      next.delete(role);
      return next;
    });
    setStatuses((previous) => {
      const next = new Map(previous);
      next.delete(role);
      return next;
    });
  }, []);

  const connectRole = useCallback(
    async (role: string) => {
      const declared = declaredRoles.find((entry) => entry.role === role);
      if (!declared) {
        return;
      }

      const generation = generationRef.current;
      const report = (status: RigRoleStatus) => {
        if (generation !== generationRef.current) {
          return;
        }
        setStatuses((previous) => new Map(previous).set(role, status));
      };

      report({ kind: "connecting" });

      let transport: ITransportAdapter | undefined;

      try {
        transport = await openSerialPort();
        const identification = await identifyBenchInstrument(transport);

        if (!identification) {
          await releasePort(transport);
          report({ kind: "unrecognised" });
          return;
        }

        const { instrument, reply } = identification;
        const answersToTheRole = handshakeMatches(reply, declared.handshake);

        // A port bound to the wrong role is worse than no port at all.
        if (!answersToTheRole) {
          await instrument.destroy();
          await releasePort(transport);
          report({ kind: "mismatch", reply });
          return;
        }

        if (generation !== generationRef.current) {
          await instrument.destroy();
          await releasePort(transport);
          return;
        }

        const port = transport;
        port.onStatusChanged((isConnected) => {
          if (!isConnected) {
            dropRole(role);
          }
        });

        setConnected((previous) => new Map(previous).set(role, { instrument, transport: port }));
        report({ kind: "connected", model: instrument.model, reply });
      } catch (error) {
        await releasePort(transport);
        report({
          kind: "failed",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [declaredRoles, dropRole],
  );

  const disconnectRole = useCallback(
    async (role: string) => {
      const entry = connectedRef.current.get(role);
      if (!entry) {
        return;
      }

      dropRole(role);

      try {
        await entry.instrument.destroy();
      } catch (error) {
        console.error("Rig disconnect error:", error);
      }
      await releasePort(entry.transport);
    },
    [dropRole],
  );

  const rest = useCallback(async () => {
    const entries = [...connectedRef.current.values()];
    await shutdownRig(entries.map((entry) => entry.instrument));
    // The device latches what a sweep wrote to it, the same as the lamp does.
    await dutSetpointRef.current?.rest().catch((error: unknown) => {
      console.error("Device could not be returned to rest:", error);
    });
  }, []);

  const restRef = useRef(rest);
  restRef.current = rest;

  const shutdownAll = useCallback(async () => {
    const entries = [...connectedRef.current.values()];
    generationRef.current += 1;

    setConnected(new Map());
    setStatuses(new Map());

    await restRef.current();
    await Promise.all(entries.map((entry) => releasePort(entry.transport)));
  }, []);

  const shutdownAllRef = useRef(shutdownAll);
  shutdownAllRef.current = shutdownAll;

  // A rig the procedure no longer declares is torn down rather than carried into the
  // next definition, where a role of the same name may want a different instrument.
  const rigSignature = declaredRoles.map((entry) => `${entry.role}:${entry.handshake}`).join("|");

  // Walking away from the wizard must not leave the lamp driving current.
  useEffect(() => {
    return () => {
      void shutdownAllRef.current();
    };
  }, [rigSignature]);

  return {
    roles,
    bindings,
    hasEveryRequiredRole,
    isConnecting,
    connectRole,
    disconnectRole,
    rest,
    shutdownAll,
  };
}
