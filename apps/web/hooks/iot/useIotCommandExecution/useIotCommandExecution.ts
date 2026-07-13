"use client";

import { useCallback } from "react";

import type { SensorFamily } from "@repo/api/schemas/command.schema";
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

// Inline commands fail fast; command code runs the full measurement budget.
const CONSOLE_COMMAND_TIMEOUT_MS = 10_000;

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useIotCommandExecution(
  driver: IDeviceDriver | null,
  isConnected: boolean,
  sensorFamily: SensorFamily,
) {
  // Library command: run its full code array as a device measurement.
  const executeCommandCode = useCallback(
    async (commandCode: Record<string, unknown>[]) => {
      if (!driver || !isConnected) {
        throw new Error("Not connected to device");
      }

      if (sensorFamily === "multispeq") {
        // MultispeQ: send the command JSON array directly; device runs the measurement
        const result = await driver.execute(commandCode);
        return parseResponseData(unwrap(result, "Command execution failed"));
      }

      // Generic / Ambyte: load config → run → retrieve data
      unwrap(
        await driver.execute({ command: "SET_CONFIG", params: { command: commandCode } }),
        "Failed to load command on device",
      );

      unwrap(await driver.execute({ command: "RUN" }), "Failed to run command");

      const data = unwrap(
        await driver.execute({ command: "GET_DATA" }),
        "Failed to get measurement data",
      );

      return parseResponseData(data);
    },
    [driver, isConnected, sensorFamily],
  );

  // Inline command cell: a raw string (`hello`, `battery`) or a parsed JSON/YAML
  // object/array, sent straight to the device with a short timeout.
  const executeInlineCommand = useCallback(
    async (command: string | Record<string, unknown> | unknown[]) => {
      if (!driver || !isConnected) {
        throw new Error("Not connected to device");
      }
      const result = await driver.execute(command, { timeoutMs: CONSOLE_COMMAND_TIMEOUT_MS });
      return parseResponseData(unwrap(result, "Command execution failed"));
    },
    [driver, isConnected],
  );

  return { executeCommandCode, executeInlineCommand };
}
