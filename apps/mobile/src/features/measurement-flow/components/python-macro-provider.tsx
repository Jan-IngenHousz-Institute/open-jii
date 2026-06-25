import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import WebView from "react-native-webview";
import { getPythonMacroSandboxHtml } from "~/features/measurement-flow/services/python/python-macro-sandbox";
import type { MacroOutput } from "~/features/measurement-flow/utils/process-scan/process-scan";
import { registerPythonMacroRunner } from "~/features/measurement-flow/utils/process-scan/python-macro-runner";
import { createLogger } from "~/shared/observability/logger";

const log = createLogger("macro-py");

interface Pending {
  resolve: (value: MacroOutput) => void;
  reject: (err: Error) => void;
}

export function PythonMacroProvider({ children }: { children: React.ReactNode }) {
  const pendingRef = useRef<Map<string, Pending>>(new Map());
  const requestIdRef = useRef(0);
  const webViewRef = useRef<WebView>(null);
  // HTML is built once the bundled helper source loads (a local file read).
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPythonMacroSandboxHtml()
      .then((h) => {
        if (alive) setHtml(h);
      })
      .catch((err) => log.error("failed to load sandbox html", { err: (err as Error)?.message }));
    return () => {
      alive = false;
    };
  }, []);

  const runPythonMacro = useCallback(async (code: string, json: object): Promise<MacroOutput> => {
    const requestId = `py-${++requestIdRef.current}`;
    return new Promise<MacroOutput>((resolve, reject) => {
      pendingRef.current.set(requestId, { resolve, reject });
      const payload = { requestId, code, json };
      const msg = JSON.stringify(payload);
      webViewRef.current?.injectJavaScript(
        `window.postMessage(${JSON.stringify(msg)}, '*'); true;`,
      );
    });
  }, []);

  // Only advertise the runner once the WebView is mounted, so a macro can't be
  // dispatched at a ref that isn't there yet (its promise would never settle).
  useEffect(() => {
    if (!html) return;
    registerPythonMacroRunner(runPythonMacro);
    return () => {
      registerPythonMacroRunner(null);
    };
  }, [html, runPythonMacro]);

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "ready") {
        log.info("sandbox ready");
        return;
      }
      if (data.requestId != null && pendingRef.current.has(data.requestId)) {
        const pending = pendingRef.current.get(data.requestId);
        pendingRef.current.delete(data.requestId);
        if (data.error) {
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
        {html ? (
          <WebView
            ref={webViewRef}
            originWhitelist={["*"]}
            source={{ html }}
            onMessage={handleMessage}
            style={{ width: 1, height: 1 }}
          />
        ) : null}
      </View>
    </View>
  );
}
