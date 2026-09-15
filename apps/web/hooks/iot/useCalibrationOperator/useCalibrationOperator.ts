"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import type { OperatorPort } from "@repo/iot";

export type OperatorRequest =
  | {
      kind: "acknowledge";
      prompt: string;
      confirm?: string;
      resolve: (accepted: boolean) => void;
    }
  | {
      kind: "readValue";
      prompt: string;
      type: "number" | "text";
      resolve: (value: number | string) => void;
      reject: (reason: Error) => void;
    };

/** Bridges the interpreter's operator port to React state; only one request is ever open. */
export function useCalibrationOperator() {
  const [pending, setPending] = useState<OperatorRequest | null>(null);
  const pendingRef = useRef<OperatorRequest | null>(null);

  const settle = useCallback(() => {
    pendingRef.current = null;
    setPending(null);
  }, []);

  const port = useMemo<OperatorPort>(
    () => ({
      acknowledge: (prompt, confirm) =>
        new Promise<boolean>((resolve) => {
          const request: OperatorRequest = {
            kind: "acknowledge",
            prompt,
            confirm,
            resolve: (accepted) => {
              settle();
              resolve(accepted);
            },
          };
          pendingRef.current = request;
          setPending(request);
        }),
      readValue: (prompt, type) =>
        new Promise<number | string>((resolve, reject) => {
          const request: OperatorRequest = {
            kind: "readValue",
            prompt,
            type,
            resolve: (value) => {
              settle();
              resolve(value);
            },
            reject: (reason) => {
              settle();
              reject(reason);
            },
          };
          pendingRef.current = request;
          setPending(request);
        }),
    }),
    [settle],
  );

  // Leaving mid-prompt: an open acknowledge is declined and an open read fails, so the run aborts either way.
  const cancel = useCallback(() => {
    const request = pendingRef.current;
    if (!request) return;
    if (request.kind === "acknowledge") {
      request.resolve(false);
    } else {
      request.reject(new Error("The operator left the bench before answering"));
    }
  }, []);

  return { port, pending, cancel };
}
