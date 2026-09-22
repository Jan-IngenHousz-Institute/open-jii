"use client";

import { useCalibrationOperator } from "@/hooks/iot/useCalibrationOperator/useCalibrationOperator";
import { useCalibrationRig } from "@/hooks/iot/useCalibrationRig/useCalibrationRig";
import { useIotConnections } from "@/hooks/iot/useIotConnections/useIotConnections";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  CalibrationFamily,
  CalibrationRunPayload,
  SkippedSeriesList,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { serialsMatch } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import type { CaptureProcedure, CapturePayload, ProcedureProgress } from "@repo/iot";
import { ProcedureAborted, runCaptureProcedure, runVerificationProcedure } from "@repo/iot";

/** The interpreter never yields null cells in practice; the contract has no room for them. */
export function toRunPayload(payload: CapturePayload): CalibrationRunPayload {
  const result: CalibrationRunPayload = {};
  for (const [series, rows] of Object.entries(payload)) {
    result[series] = rows.map((row) =>
      Object.fromEntries(Object.entries(row).filter(([, cell]) => cell !== null)),
    );
  }
  return result;
}

/** How a phase ended. Anything short of captured carries what the bench had read by then. */
export type PhaseResult =
  | { kind: "captured"; payload: CalibrationRunPayload; skipped: SkippedSeriesList }
  | PhaseFailure;

export type PhaseFailure =
  | { kind: "stopped"; partial: CalibrationRunPayload }
  | { kind: "disconnected" }
  | { kind: "noProcedure" }
  | { kind: "failed"; message: string; partial: CalibrationRunPayload };

/**
 * The unit on the port, held against the device this session is for. A family whose
 * firmware announces no identifier of its own leaves the question open, and the record
 * says as much rather than implying the two were compared.
 */
export type UnitIdentity =
  | { kind: "unnamed" }
  /** It said who it is, and there was no expectation to hold it against. */
  | { kind: "reported"; serial: string }
  | { kind: "match"; serial: string }
  | { kind: "mismatch"; reported: string; expected: string };

function identifyUnit(reported: string | undefined, expected: string | null): UnitIdentity {
  if (reported === undefined || reported.trim() === "") {
    return { kind: "unnamed" };
  }
  // A bench takes whatever is put on it and works out afterwards which device that is, so
  // there is nothing for the unit to contradict.
  if (expected === null) {
    return { kind: "reported", serial: reported };
  }
  return serialsMatch(reported, expected)
    ? { kind: "match", serial: reported }
    : { kind: "mismatch", reported, expected };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Connecting a rig and running a procedure's phases against it.
 *
 * Owned here rather than in the wizard because it is the half a definition's author needs
 * too: trying a procedure at the bench while writing it is the only way to find out that
 * a handshake, a command or a setpoint was wrong. What differs between the two callers is
 * only what they do with the readings afterwards.
 */
export function useCalibrationCapture(
  procedure: CaptureProcedure | undefined,
  family: CalibrationFamily,
  /** The device this session is for, or null at a bench that identifies units as they come. */
  serialNumber: string | null,
) {
  const [events, setEvents] = useState<ProcedureProgress[]>([]);
  const [failure, setFailure] = useState<PhaseFailure | null>(null);
  const [restFailure, setRestFailure] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // The drivers outlive this hook's own teardown, which rests the bench through them first.
  const connections = useIotConnections(family, { destroyOnUnmount: false });
  const operator = useCalibrationOperator();
  const connection = connections.connections.at(0);

  // One phase at a time: a second start while one is in flight would drive the bench from
  // two procedures at once. Refs, because stopping and leaving have to reach the run in
  // flight without being rebuilt every time one starts or ends.
  const inFlightRef = useRef<Promise<PhaseResult> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const cancelOperator = operator.cancel;

  /** Between two things the interpreter was about to do, or out of the prompt it waits on. */
  const stop = useCallback(() => {
    controllerRef.current?.abort();
    cancelOperator();
  }, [cancelOperator]);

  const stopRef = useRef(stop);
  stopRef.current = stop;

  // Declared before the rig so that on unmount its cleanup runs first: a sweep has to be
  // stopped before the bench is rested under it, or a setpoint lands after the zero write.
  useEffect(() => {
    return () => stopRef.current();
  }, []);

  const rig = useCalibrationRig(procedure, connection?.driver, { shutdownOnUnmount: false });

  const unit =
    connection === undefined ? undefined : identifyUnit(connection.identity.deviceId, serialNumber);

  // The rig object is new on every render; the callbacks below hold the ref instead.
  const rigRef = useRef(rig);
  rigRef.current = rig;

  const runPhase = useCallback(
    (run: typeof runCaptureProcedure): Promise<PhaseResult> => {
      if (inFlightRef.current) {
        return inFlightRef.current;
      }

      const refuse = (reason: PhaseFailure): Promise<PhaseResult> => {
        setFailure(reason);
        return Promise.resolve(reason);
      };
      if (!procedure) {
        return refuse({ kind: "noProcedure" });
      }
      // The port can be pulled between one phase and the next. Returning quietly here left
      // a finished sweep discarded and a step with no button on it at all.
      if (!connection) {
        return refuse({ kind: "disconnected" });
      }

      const controller = new AbortController();
      controllerRef.current = controller;
      setIsRunning(true);
      setFailure(null);
      setRestFailure(null);
      setEvents([]);

      const attempt = (async (): Promise<PhaseResult> => {
        try {
          const result = await run(procedure, {
            rig: rigRef.current.bindings,
            operator: operator.port,
            signal: controller.signal,
            onProgress: (event) => setEvents((previous) => [...previous, event]),
          });
          return {
            kind: "captured",
            payload: toRunPayload(result.payload),
            skipped: result.skipped,
          };
        } catch (caught) {
          const partial =
            caught instanceof ProcedureAborted ? toRunPayload(caught.partial.payload) : {};
          // A stop declines the prompt the interpreter was waiting on, so whatever reason
          // it unwinds with underneath, the stop is what happened.
          const outcome: PhaseFailure = controller.signal.aborted
            ? { kind: "stopped", partial }
            : { kind: "failed", message: messageOf(caught), partial };
          setFailure(outcome);
          return outcome;
        } finally {
          // A lamp left driven after an aborted sweep is what a bench must never see.
          try {
            await rigRef.current.rest();
          } catch (error) {
            setRestFailure(messageOf(error));
          }
          controllerRef.current = null;
          inFlightRef.current = null;
          setIsRunning(false);
        }
      })();

      inFlightRef.current = attempt;
      return attempt;
    },
    [connection, operator.port, procedure],
  );

  const capture = useCallback(() => runPhase(runCaptureProcedure), [runPhase]);
  const verify = useCallback(() => runPhase(runVerificationProcedure), [runPhase]);

  const disconnectAll = connections.disconnectAll;

  /**
   * Between one unit and the next: the bench goes quiet and the unit's port is let go, but
   * the instruments stay bound.
   *
   * A batch is one setup and many units. Closing the lamp and the reference between each
   * would make the operator rebuild the rig for every piece of hardware they pick up, and
   * every one of those reconnections is a chance to bind the wrong port.
   */
  const releaseUnit = useCallback(async (): Promise<string | null> => {
    stop();
    await inFlightRef.current;

    // Rested, not shut down: a lamp must not be left driving current while someone has
    // their hands on the bench swapping hardware.
    let notAtRest: string | null = null;
    try {
      await rigRef.current.rest();
    } catch (error) {
      notAtRest = messageOf(error);
    }
    await disconnectAll();

    return notAtRest;
  }, [disconnectAll, stop]);

  /** Stop, wait for the interpreter to let go, rest and close the bench, then release the device. */
  const leave = useCallback(async (): Promise<string | null> => {
    stop();
    await inFlightRef.current;

    let notAtRest: string | null = null;
    try {
      await rigRef.current.shutdownAll();
    } catch (error) {
      notAtRest = messageOf(error);
    }
    await disconnectAll();

    return notAtRest;
  }, [disconnectAll, stop]);

  const leaveRef = useRef(leave);
  leaveRef.current = leave;

  // Walking away is the path an operator takes most often, and the one that would leave a
  // lamp driving current with no page left to turn it off.
  useEffect(() => {
    return () => {
      void leaveRef.current();
    };
  }, []);

  return {
    connection,
    unit,
    isConnecting: connections.isConnecting,
    connectError: connections.error,
    connect: () => void connections.connect("serial"),
    disconnect: () => void connections.disconnectAll(),
    rig,
    operator,
    /**
     * The procedure is loaded, the unit answering is the device this session is for, and
     * every role the run requires is bound.
     */
    canStart:
      procedure !== undefined &&
      connection?.family === family &&
      unit?.kind !== "mismatch" &&
      rig.hasEveryRequiredRole,
    events,
    isRunning,
    failure,
    setFailure,
    restFailure,
    capture,
    verify,
    stop,
    releaseUnit,
    leave,
  };
}
