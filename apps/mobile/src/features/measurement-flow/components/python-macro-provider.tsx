import { onlineManager } from "@tanstack/react-query";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import WebView from "react-native-webview";
import { pythonMacroSandboxHtml } from "~/features/measurement-flow/services/python/python-macro-sandbox";
import type { MacroOutput } from "~/features/measurement-flow/utils/process-scan/process-scan";
import { registerPythonMacroRunner } from "~/features/measurement-flow/utils/process-scan/python-macro-runner";
import { PythonRuntimeUnavailableError } from "~/shared/measurements/python-runtime-unavailable-error";
import { createLogger } from "~/shared/observability/logger";

const log = createLogger("macro-py");

// The runtime downloads from a CDN; on a stalled connection a request would
// otherwise wait for it indefinitely.
const RUNTIME_LOAD_TIMEOUT_MS = 30_000;

type RuntimeStatus = "loading" | "ready" | "unavailable";

interface Pending {
  resolve: (value: MacroOutput) => void;
  reject: (err: Error) => void;
  loadTimer?: ReturnType<typeof setTimeout>;
}

export function PythonMacroProvider({ children }: { children: React.ReactNode }) {
  const pendingRef = useRef<Map<string, Pending>>(new Map());
  const requestIdRef = useRef(0);
  // "unavailable" covers a failed load and one that outlasted the timeout: a
  // failed wasm download can leave loadPyodide pending rather than rejected.
  // Requests then fail at once instead of each waiting out the timeout.
  const runtimeStatusRef = useRef<RuntimeStatus>("loading");
  // A new key remounts the WebView, which is how a failed runtime downloads again.
  const [sandboxKey, setSandboxKey] = useState(0);
  const webViewRef = useRef<WebView>(null);

  const runPythonMacro = useCallback(
    async (
      code: string,
      json: unknown,
      ctx: Record<string, unknown> = {},
    ): Promise<MacroOutput> => {
      const requestId = `py-${++requestIdRef.current}`;
      return new Promise<MacroOutput>((resolve, reject) => {
        if (runtimeStatusRef.current === "unavailable") {
          reject(new PythonRuntimeUnavailableError("Pyodide is not loaded"));
          return;
        }

        const loadTimer =
          runtimeStatusRef.current === "ready"
            ? undefined
            : setTimeout(() => {
                if (!pendingRef.current.delete(requestId)) {
                  return;
                }
                log.warn("runtime still loading - giving up on request", { requestId });
                runtimeStatusRef.current = "unavailable";
                reject(new PythonRuntimeUnavailableError("Pyodide did not load in time"));
              }, RUNTIME_LOAD_TIMEOUT_MS);
        pendingRef.current.set(requestId, { resolve, reject, loadTimer });
        const payload = { requestId, code, json, ctx };
        const msg = JSON.stringify(payload);
        webViewRef.current?.injectJavaScript(
          `window.postMessage(${JSON.stringify(msg)}, '*'); true;`,
        );
      });
    },
    [],
  );

  useEffect(() => {
    registerPythonMacroRunner(runPythonMacro);
    return () => {
      registerPythonMacroRunner(null);
    };
  }, [runPythonMacro]);

  // A failed download stays failed in the loaded page, so the runtime gets a
  // fresh WebView when the connection returns.
  useEffect(
    () =>
      onlineManager.subscribe((online) => {
        if (!online || runtimeStatusRef.current !== "unavailable") {
          return;
        }
        log.info("connection back - reloading the runtime");
        // The old page can no longer answer, and its timers must not mark the
        // fresh load unavailable.
        pendingRef.current.forEach((pending) => {
          clearTimeout(pending.loadTimer);
          pending.reject(new PythonRuntimeUnavailableError("Pyodide is reloading"));
        });
        pendingRef.current.clear();
        runtimeStatusRef.current = "loading";
        setSandboxKey((key) => key + 1);
      }),
    [],
  );

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "ready") {
        log.info("sandbox ready");
        runtimeStatusRef.current = "ready";
        // Queued requests now run; a slow macro must not trip the load timeout.
        pendingRef.current.forEach((pending) => clearTimeout(pending.loadTimer));
        return;
      }
      if (data.type === "error") {
        log.warn("sandbox could not load the runtime", { err: data.message });
        runtimeStatusRef.current = "unavailable";
        return;
      }
      if (data.requestId != null && pendingRef.current.has(data.requestId)) {
        const pending = pendingRef.current.get(data.requestId);
        pendingRef.current.delete(data.requestId);
        clearTimeout(pending?.loadTimer);
        if (data.runtimeUnavailable) {
          pending?.reject(new PythonRuntimeUnavailableError(data.error));
        } else if (data.error) {
          log.error("sandbox error", { requestId: data.requestId, err: data.error });
          pending?.reject(new Error(data.error));
        } else {
          log.debug("sandbox result", { requestId: data.requestId });
          pending?.resolve((data.result ?? {}) as MacroOutput);
        }
      }
    } catch {
      // ignore parse errors for non-JSON messages
    }
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>{children}</View>
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1,
          height: 1,
          opacity: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        <WebView
          key={sandboxKey}
          ref={webViewRef}
          originWhitelist={["*"]}
          source={{ html: pythonMacroSandboxHtml }}
          onMessage={handleMessage}
          style={{ width: 1, height: 1 }}
        />
      </View>
    </View>
  );
}
