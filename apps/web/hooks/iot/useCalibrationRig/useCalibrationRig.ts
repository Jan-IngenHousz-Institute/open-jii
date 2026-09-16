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
  | { kind: "mismatch"; model: string; reply: string }
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
  model: string | undefined;
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
  const releasingRef = useRef(new Set<string>());
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
              model: instrument.model,
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

  const disconnectRole = useCallback(
    async (role: string) => {
      const entry = connectedRef.current.get(role);
      // The ref only catches up on the next render, so an in-flight release is tracked here:
      // closing a port fires its own status callback, which asks for this again.
      if (!entry || releasingRef.current.has(role)) {
        return;
      }

      releasingRef.current.add(role);
      dropRole(role);

      try {
        await entry.instrument.destroy();
      } catch (error) {
        console.error("Rig disconnect error:", error);
      }
      await releasePort(entry.transport);
      releasingRef.current.delete(role);
    },
    [dropRole],
  );

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
        // A handshake that names one unit of a model says nothing about the model, so a
        // supply answering to a name meant for a reference would otherwise be accepted.
        const isTheDeclaredModel =
          declared.model === undefined || declared.model === instrument.model;

        // A port bound to the wrong role is worse than no port at all.
        if (!answersToTheRole || !isTheDeclaredModel) {
          await instrument.destroy();
          await releasePort(transport);
          report({ kind: "mismatch", model: instrument.model, reply });
          return;
        }

        if (generation !== generationRef.current) {
          await instrument.destroy();
          await releasePort(transport);
          return;
        }

        const port = transport;
        // A port that reports itself gone is not necessarily closed: the adapter says so on
        // a read-loop error while the writer still works, so the instrument is shut down and
        // the port released rather than merely forgotten.
        port.onStatusChanged((isConnected) => {
          if (!isConnected) {
            void disconnectRole(role);
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
    [declaredRoles, disconnectRole],
  );

  const rest = useCallback(async () => {
    const entries = [...connectedRef.current.values()];

    // The device first: its port belongs to the connection hook, which closes it on the
    // same unmount, so its rest must not queue behind the bench's serial writes. The bench
    // ports are this hook's own and outlive that race.
    await dutSetpointRef.current?.rest().catch((error: unknown) => {
      console.error("Device could not be returned to rest:", error);
    });
    await shutdownRig(entries.map((entry) => entry.instrument));
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
  const rigSignature = declaredRoles
    .map((entry) => `${entry.role}:${entry.handshake}:${entry.model ?? ""}`)
    .join("|");

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
