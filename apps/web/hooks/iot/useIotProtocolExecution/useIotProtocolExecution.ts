"use client";

import { useCallback } from "react";

import type { IDeviceProtocol } from "@repo/iot";

export function useIotProtocolExecution(protocol: IDeviceProtocol | null, isConnected: boolean) {
  const executeProtocol = useCallback(
    async (protocolCode: Record<string, unknown>[]) => {
      if (!protocol || !isConnected) {
        throw new Error("Not connected to device");
      }

      // Load protocol definition on the device
      const setResult = await protocol.execute({
        command: "SET_CONFIG",
        params: { protocol: protocolCode },
      });
      if (!setResult.success) {
        throw new Error(setResult.error?.message ?? "Failed to load protocol on device");
      }

      // Execute the loaded protocol
      const runResult = await protocol.execute({ command: "RUN" });
      if (!runResult.success) {
        throw new Error(runResult.error?.message ?? "Failed to run protocol");
      }

      // Retrieve measurement results
      const dataResult = await protocol.execute({ command: "GET_DATA" });
      if (!dataResult.success) {
        throw new Error(dataResult.error?.message ?? "Failed to get measurement data");
      }

      let data = dataResult.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch {
          // keep the string as-is if it's not valid JSON
        }
      }

      return data;
    },
    [protocol, isConnected],
  );

  return { executeProtocol };
}
