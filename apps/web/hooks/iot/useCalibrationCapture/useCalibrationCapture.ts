"use client";

import { useCalibrationOperator } from "@/hooks/iot/useCalibrationOperator/useCalibrationOperator";
import { useCalibrationRig } from "@/hooks/iot/useCalibrationRig/useCalibrationRig";
import { useIotConnections } from "@/hooks/iot/useIotConnections/useIotConnections";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  CalibrationFamily,
  CalibrationRunPayload,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import type { CaptureProcedure, CapturePayload, ProcedureProgress } from "@repo/iot";
import { runCaptureProcedure } from "@repo/iot";

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

/**
 * Connecting a rig and running a capture procedure against it.
 *
 * Owned here rather than in the wizard because it is the half a definition's author needs
 * too: trying a procedure at the bench while writing it is the only way to find out that
 * a handshake, a command or a setpoint was wrong. What differs between the two callers is
 * only what they do with the readings afterwards.
 */
export function useCalibrationCapture(
  procedure: CaptureProcedure | undefined,
  family: CalibrationFamily,
) {
  const [events, setEvents] = useState<ProcedureProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const connections = useIotConnections(family);
  const operator = useCalibrationOperator();
  const connection = connections.connections.at(0);
  const rig = useCalibrationRig(procedure, connection?.driver);

  // Leaving mid-run must not leave the interpreter awaiting a prompt.
  const cancelOperator = operator.cancel;
  useEffect(() => cancelOperator, [cancelOperator]);

  // A second start while one is in flight would drive the bench from two procedures at
  // once. A ref, because the flag is read by a callback that must not be rebuilt every
  // time a capture starts or stops.
  const isCapturingRef = useRef(false);

  // The rig object is new on every render; the dependency lists below hold the ref instead.
  const rigRef = useRef(rig);
  rigRef.current = rig;

  const capture = useCallback(async (): Promise<CalibrationRunPayload | null> => {
    if (!procedure || !connection || isCapturingRef.current) {
      return null;
    }
    isCapturingRef.current = true;
    setIsCapturing(true);
    setError(null);
    setEvents([]);

    try {
      const result = await runCaptureProcedure(procedure, {
        rig: rigRef.current.bindings,
        operator: operator.port,
        onProgress: (event) => setEvents((previous) => [...previous, event]),
      });
      return toRunPayload(result.payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return null;
    } finally {
      // A lamp left driven after an aborted sweep is what a bench must never see.
      await rigRef.current.rest();
      isCapturingRef.current = false;
      setIsCapturing(false);
    }
  }, [connection, operator.port, procedure]);

  return {
    connection,
    isConnectedToFamily: connection?.family === family,
    isConnecting: connections.isConnecting,
    connectError: connections.error,
    connect: () => void connections.connect("serial"),
    disconnect: () => void connections.disconnectAll(),
    rig,
    operator,
    /** The device is on a port and every role the procedure requires is bound. */
    canStart: connection?.family === family && rig.hasEveryRequiredRole,
    events,
    isCapturing,
    error,
    setError,
    capture,
  };
}
