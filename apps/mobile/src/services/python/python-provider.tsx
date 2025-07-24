import { WebViewRef } from "expo/build/dom/dom.types";
import React, { useRef } from "react";
import { View } from "react-native";
import WebView from "react-native-webview";
import { pythonSandboxHtml } from "~/services/python/python-sandbox-html";

export function PythonProvider({ children }) {
  const webviewRef = useRef<WebViewRef>(null);
  const promiseRef = useRef<any>(undefined);

  const executePython = (code: string) => {
    return new Promise<string>((resolve, reject) => {
      webviewRef.current?.postMessage(code);
      promiseRef.current = resolve;
    });
  };

  return (
    <View>
      <WebView
        ref={webviewRef}
        originWhitelist={["*"]}
        source={{ html: pythonSandboxHtml }}
        onMessage={(event) => {
          const message = event.nativeEvent.data;
          promiseRef.current?.(message);
        }}
        style={{
          width: 0,
          height: 0,
          opacity: 0,
        }}
      />
      {children}
    </View>
  );
}
