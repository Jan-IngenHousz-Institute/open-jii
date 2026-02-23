import React, { useCallback, useEffect, useRef } from "react";
import { View } from "react-native";
import WebView from "react-native-webview";
import { registerPythonMacroRunner } from "~/utils/process-scan/python-macro-runner";
import type { MacroOutput } from "~/utils/process-scan/process-scan";
import { pythonMacroSandboxHtml } from "~/services/python/python-macro-sandbox";

type Pending = { resolve: (value: MacroOutput) => void; reject: (err: Error) => void };

export function PythonMacroProvider({ children }: { children: React.ReactNode }) {
  const pendingRef = useRef<Map<string, Pending>>(new Map());
  const requestIdRef = useRef(0);
  const webViewRef = useRef<WebView>(null);

  const runPythonMacro = useCallback(async (code: string, json: object): Promise<MacroOutput> => {
    const requestId = `py-${++requestIdRef.current}`;
    return new Promise<MacroOutput>((resolve, reject) => {
      pendingRef.current.set(requestId, { resolve, reject });
      const payload = { requestId, code, json };
      const msg = JSON.stringify(payload);
      webViewRef.current?.injectJavaScript(
        `window.postMessage(${JSON.stringify(msg)}, '*'); true;`
      );
    });
  }, []);

  useEffect(() => {
    registerPythonMacroRunner(runPythonMacro);
    return () => {
      registerPythonMacroRunner(null);
    };
  }, [runPythonMacro]);

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "ready") {
        console.log("[macro] (Python) sandbox ready");
        return;
      }
      if (data.requestId != null && pendingRef.current.has(data.requestId)) {
        const pending = pendingRef.current.get(data.requestId)!;
        pendingRef.current.delete(data.requestId);
        if (data.error) {
          console.error("[macro] (Python) sandbox error:", data.error);
          pending.reject(new Error(data.error));
        } else {
          console.log("[macro] (Python) sandbox result:", JSON.stringify(data.result));
          pending.resolve((data.result ?? {}) as MacroOutput);
        }
      }
    } catch (_) {
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
