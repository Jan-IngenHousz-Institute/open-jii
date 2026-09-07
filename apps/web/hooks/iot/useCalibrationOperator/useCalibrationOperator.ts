"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import type { OperatorPort } from "@repo/iot";

/** A question the procedure is waiting on the person at the bench to answer. */
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
    };

/**
 * Bridges the interpreter's operator port to React state. The interpreter
 * awaits a promise; the wizard renders whatever request is pending and
 * settles it from the screen. Only one request is ever open, because the
 * procedure is sequential.
 */
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
        new Promise<number | string>((resolve) => {
          const request: OperatorRequest = {
            kind: "readValue",
            prompt,
            type,
            resolve: (value) => {
              settle();
              resolve(value);
            },
          };
          pendingRef.current = request;
          setPending(request);
        }),
    }),
    [settle],
  );

  // Leaving the wizard mid-prompt must not leave the interpreter awaiting
  // forever: an open acknowledge is declined, an open read answers nothing
  // useful, and the run aborts through the normal path.
  const cancel = useCallback(() => {
    const request = pendingRef.current;
    if (!request) return;
    if (request.kind === "acknowledge") {
      request.resolve(false);
    } else {
      request.resolve(Number.NaN);
    }
  }, []);

  return { port, pending, cancel };
}
