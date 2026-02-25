"use client";

import { useCallback } from "react";

import type { IDeviceProtocol } from "@repo/iot";

export function useIotProtocolExecution(protocol: IDeviceProtocol | null, isConnected: boolean) {
  const executeProtocol = useCallback(
    async (protocolCode: Record<string, unknown>[]) => {
      console.log("[useIotProtocolExecution] Starting protocol execution, connected:", isConnected);

      if (!protocol || !isConnected) {
        console.error(
          "[useIotProtocolExecution] Not connected to device, protocol:",
          !!protocol,
          "isConnected:",
          isConnected,
        );
        throw new Error("Not connected to device");
      }

      // Load protocol definition on the device
      console.log(
        "[useIotProtocolExecution] Step 1/3: SET_CONFIG - loading protocol on device, protocol length:",
        JSON.stringify(protocolCode).length,
      );
      const setResult = await protocol.execute({
        command: "SET_CONFIG",
        params: { protocol: protocolCode },
      });
      console.log("[useIotProtocolExecution] SET_CONFIG result:", {
        success: setResult.success,
        error: setResult.error?.message,
      });
      if (!setResult.success) {
        throw new Error(setResult.error?.message ?? "Failed to load protocol on device");
      }

      // Execute the loaded protocol
      console.log("[useIotProtocolExecution] Step 2/3: RUN - executing protocol");
      const runResult = await protocol.execute({ command: "RUN" });
      console.log("[useIotProtocolExecution] RUN result:", {
        success: runResult.success,
        error: runResult.error?.message,
      });
      if (!runResult.success) {
        throw new Error(runResult.error?.message ?? "Failed to run protocol");
      }

      // Retrieve measurement results
      console.log("[useIotProtocolExecution] Step 3/3: GET_DATA - retrieving results");
      const dataResult = await protocol.execute({ command: "GET_DATA" });
      console.log("[useIotProtocolExecution] GET_DATA result:", {
        success: dataResult.success,
        error: dataResult.error?.message,
        dataType: typeof dataResult.data,
      });
      if (!dataResult.success) {
        throw new Error(dataResult.error?.message ?? "Failed to get measurement data");
      }

      let data = dataResult.data;
      if (typeof data === "string") {
        console.log("[useIotProtocolExecution] Parsing string data, length:", data.length);
        try {
          data = JSON.parse(data);
        } catch {
          console.warn("[useIotProtocolExecution] Data is not valid JSON, keeping as string");
          // keep the string as-is if it's not valid JSON
        }
      }

      console.log("[useIotProtocolExecution] Protocol execution complete");
      return data;
    },
    [protocol, isConnected],
  );

  return { executeProtocol };
}
