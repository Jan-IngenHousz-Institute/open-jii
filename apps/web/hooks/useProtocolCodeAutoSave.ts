import { useProtocolUpdate } from "@/hooks/protocol/useProtocolUpdate/useProtocolUpdate";
import { useCallback } from "react";

import { useCodeAutoSave } from "./useCodeAutoSave";

export type ProtocolCode = Record<string, unknown>[] | string | undefined;

export function useProtocolCodeAutoSave(protocolId: string) {
  const { mutate: saveProtocol } = useProtocolUpdate(protocolId);

  const buildPayload = useCallback(
    (code: ProtocolCode) => ({
      params: { id: protocolId },
      body: { code: code as Record<string, unknown>[] },
    }),
    [protocolId],
  );

  return useCodeAutoSave<ProtocolCode, ReturnType<typeof buildPayload>>({
    saveFn: saveProtocol,
    buildPayload,
    toKey: (code) => JSON.stringify(code),
    isValid: (value) => Array.isArray(value),
  });
}
