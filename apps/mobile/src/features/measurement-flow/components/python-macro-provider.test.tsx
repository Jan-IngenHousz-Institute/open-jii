import { render } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pythonMacroSandboxHtml } from "~/features/measurement-flow/services/python/python-macro-sandbox";
import {
  getPythonMacroRunner,
  registerPythonMacroRunner,
} from "~/features/measurement-flow/utils/process-scan/python-macro-runner";

import { PythonMacroProvider } from "./python-macro-provider";

const { injectJavaScript, webViewProps } = vi.hoisted(() => ({
  injectJavaScript: vi.fn(),
  webViewProps: vi.fn(),
}));

vi.mock("react-native-webview", () => ({
  default: React.forwardRef((props: Record<string, unknown>, ref) => {
    webViewProps(props);
    React.useImperativeHandle(ref, () => ({ injectJavaScript }));
    return null;
  }),
}));
vi.mock("~/shared/observability/logger", () => ({
  createLogger: () => ({
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  }),
}));

function inlineSandboxScript(): string {
  const scripts = Array.from(
    pythonMacroSandboxHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi),
  );
  const source = scripts.at(-1)?.[1];
  if (!source) throw new Error("Python sandbox inline script not found");
  return source;
}

function providerMessageFromInjection(source: string): string {
  const prefix = "window.postMessage(";
  const suffix = ", '*'); true;";
  if (!source.startsWith(prefix) || !source.endsWith(suffix)) {
    throw new Error(`Unexpected WebView injection: ${source}`);
  }
  return JSON.parse(source.slice(prefix.length, -suffix.length)) as string;
}

function bootSandbox(onMessage: (data: string) => void) {
  let messageHandler: ((event: { data: string }) => void) | undefined;
  let resultHolder: { result?: string } | undefined;
  const decodedInputs: unknown[] = [];

  const windowStub: Record<string, unknown> & {
    addEventListener: (type: string, handler: (event: { data: string }) => void) => void;
  } = {
    addEventListener(type, handler) {
      if (type === "message") messageHandler = handler;
    },
  };
  const nativeBridge = { postMessage: onMessage };
  windowStub.ReactNativeWebView = nativeBridge;
  const pyodide = {
    globals: {
      set(_name: string, value: { result?: string }) {
        resultHolder = value;
      },
    },
    runPythonAsync(source: string) {
      const match = /__json_input__ = json\.loads\(base64\.b64decode\("([^"]+)"\)/.exec(source);
      if (!match) throw new Error("Encoded Python json input not found");
      const value = JSON.parse(Buffer.from(match[1], "base64").toString("utf8")) as unknown;
      decodedInputs.push(value);
      if (resultHolder) resultHolder.result = JSON.stringify({ echo: value });
      return Promise.resolve();
    },
  };

  // Execute the real inline listener while replacing only Pyodide itself.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const start = new Function(
    "window",
    "ReactNativeWebView",
    "loadPyodide",
    "pyodide",
    inlineSandboxScript(),
  );
  start(windowStub, nativeBridge, () => Promise.resolve(pyodide), pyodide);

  return {
    receive(data: string) {
      if (!messageHandler) throw new Error("Python sandbox message listener not registered");
      messageHandler({ data });
    },
    decodedInputs,
  };
}

afterEach(() => {
  registerPythonMacroRunner(null);
  injectJavaScript.mockReset();
  webViewProps.mockClear();
});

describe("PythonMacroProvider falsy input boundary", () => {
  it.each([
    ["zero", 0],
    ["false", false],
    ["an empty string", ""],
  ])(
    "preserves %s through provider serialization and the real sandbox listener",
    async (_label, value) => {
      render(
        <PythonMacroProvider>
          <Text>child</Text>
        </PythonMacroProvider>,
      );
      const providerOnMessage = webViewProps.mock.calls.at(-1)?.[0]?.onMessage as
        | ((event: { nativeEvent: { data: string } }) => void)
        | undefined;
      expect(providerOnMessage).toBeTypeOf("function");

      const sandbox = bootSandbox((data) => providerOnMessage?.({ nativeEvent: { data } }));
      const runner = getPythonMacroRunner();
      expect(runner).not.toBeNull();

      const resultPromise = runner?.("return json", value, {});
      const injected = injectJavaScript.mock.calls.at(-1)?.[0] as string;
      sandbox.receive(providerMessageFromInjection(injected));

      await expect(resultPromise).resolves.toEqual({ echo: value });
      expect(sandbox.decodedInputs).toEqual([value]);
    },
  );
});
