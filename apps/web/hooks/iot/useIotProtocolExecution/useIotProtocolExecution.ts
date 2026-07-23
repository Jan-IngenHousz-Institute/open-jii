"use client";

import { useCallback } from "react";

import type { SensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import type { CommandResult, IDeviceDriver } from "@repo/iot";

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** Throw if the command result indicates failure, otherwise return its data. */
function unwrap<T>(result: CommandResult<T>, fallbackMessage: string): T {
  if (!result.success) {
    throw new Error(result.error?.message ?? fallbackMessage);
  }
  return result.data as T;
}

/** Try to parse a string as JSON; return the original value for anything else. */
function parseResponseData(data: unknown): unknown {
  if (typeof data !== "string") return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

// Console commands fail fast; protocols run the full measurement budget.
const CONSOLE_COMMAND_TIMEOUT_MS = 10_000;

/**
 * Run a protocol on one connected driver. Extracted from the hook so the
 * workbook's multi-device fan-out can execute per-driver without extra hooks.
 */
export async function executeProtocolWithDriver(
  driver: IDeviceDriver,
  sensorFamily: SensorFamily,
  protocolCode: Record<string, unknown>[],
): Promise<unknown> {
  if (sensorFamily === "multispeq" || sensorFamily === "minipar") {
    // MultispeQ + MiniPAR: send the protocol JSON array directly; the device
    // runs the measurement and replies one envelope.
    const result = await driver.execute(protocolCode);
    return parseResponseData(unwrap(result, "Protocol execution failed"));
  }

  if (sensorFamily === "ambit") {
    // Ambit measures via its Ambyte gateway; a direct session is command/response.
    throw new Error(
      "Ambit devices do not run protocol cells over a direct connection. Use a command cell instead.",
    );
  }

  // Generic: load config → run → retrieve data
  unwrap(
    await driver.execute({ command: "SET_CONFIG", params: { protocol: protocolCode } }),
    "Failed to load protocol on device",
  );

  unwrap(await driver.execute({ command: "RUN" }), "Failed to run protocol");

  const data = unwrap(
    await driver.execute({ command: "GET_DATA" }),
    "Failed to get measurement data",
  );

  return parseResponseData(data);
}

/**
 * Send an inline command (raw string or parsed JSON/YAML value) to one driver
 * with the short console timeout.
 */
export async function executeCommandWithDriver(
  driver: IDeviceDriver,
  command: string | Record<string, unknown> | unknown[],
): Promise<unknown> {
  const result = await driver.execute(command, { timeoutMs: CONSOLE_COMMAND_TIMEOUT_MS });
  return parseResponseData(unwrap(result, "Command execution failed"));
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useIotProtocolExecution(
  driver: IDeviceDriver | null,
  isConnected: boolean,
  sensorFamily: SensorFamily,
) {
  const executeProtocol = useCallback(
    async (protocolCode: Record<string, unknown>[]) => {
      if (!driver || !isConnected) {
        throw new Error("Not connected to device");
      }
      return executeProtocolWithDriver(driver, sensorFamily, protocolCode);
    },
    [driver, isConnected, sensorFamily],
  );

  // Inline command cell: a raw string (`hello`, `battery`) or a parsed JSON/YAML
  // object/array, sent straight to the device with a short timeout.
  const executeCommand = useCallback(
    async (command: string | Record<string, unknown> | unknown[]) => {
      if (!driver || !isConnected) {
        throw new Error("Not connected to device");
      }
      return executeCommandWithDriver(driver, command);
    },
    [driver, isConnected],
  );

  return { executeProtocol, executeCommand };
}
