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

      // Send protocol code directly to the device and wait for measurement result.
      // The MultispeQ firmware expects the raw protocol JSON array — NOT a command envelope.
      // This matches the mobile app behavior (see scan-manager.ts → executeCommand).
      console.log(
        "[useIotProtocolExecution] Sending protocol code to device, length:",
        JSON.stringify(protocolCode).length,
      );
      const result = await protocol.execute(protocolCode);
      console.log("[useIotProtocolExecution] Protocol result:", {
        success: result.success,
        error: result.error?.message,
        dataType: typeof result.data,
      });
      if (!result.success) {
        throw new Error(result.error?.message ?? "Failed to execute protocol on device");
      }

      let data = result.data;
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
