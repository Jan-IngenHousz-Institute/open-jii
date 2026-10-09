import { render } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  pythonMacroSandboxHtml,
  pythonMacroSandboxScript,
} from "~/features/measurement-flow/services/python/python-macro-sandbox";
import {
  getPythonMacroRunner,
  registerPythonMacroRunner,
} from "~/features/measurement-flow/utils/process-scan/python-macro-runner";
import { PythonRuntimeUnavailableError } from "~/shared/measurements/python-runtime-unavailable-error";

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

function providerMessageFromInjection(source: string): string {
  const prefix = "window.postMessage(";
  const suffix = ", '*'); true;";
  if (!source.startsWith(prefix) || !source.endsWith(suffix)) {
    throw new Error(`Unexpected WebView injection: ${source}`);
  }
  return JSON.parse(source.slice(prefix.length, -suffix.length)) as string;
}

// `loader` stands in for the global the CDN script defines; pass it as
// undefined to boot a sandbox whose runtime script never loaded.
function bootSandbox(onMessage: (data: string) => void, options: { loader?: unknown } = {}) {
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
    pythonMacroSandboxScript,
  );
  start(
    windowStub,
    nativeBridge,
    "loader" in options ? options.loader : () => Promise.resolve(pyodide),
    pyodide,
  );

  return {
    receive(data: string) {
      if (!messageHandler) throw new Error("Python sandbox message listener not registered");
      messageHandler({ data });
    },
    decodedInputs,
  };
}

function mountProvider() {
  render(
    <PythonMacroProvider>
      <Text>child</Text>
    </PythonMacroProvider>,
  );
  const onMessage = webViewProps.mock.calls.at(-1)?.[0]?.onMessage as
    | ((event: { nativeEvent: { data: string } }) => void)
    | undefined;
  if (!onMessage) {
    throw new Error("PythonMacroProvider did not render its WebView");
  }
  const runner = getPythonMacroRunner();
  if (!runner) {
    throw new Error("PythonMacroProvider did not register a runner");
  }

  return { onMessage, runner };
}

afterEach(() => {
  vi.useRealTimers();
  registerPythonMacroRunner(null);
  injectJavaScript.mockReset();
  webViewProps.mockClear();
});

describe("PythonMacroProvider without a runtime", () => {
  it("answers instead of waiting when the runtime script never loaded", async () => {
    const { onMessage, runner } = mountProvider();
    const sandbox = bootSandbox((data) => onMessage({ nativeEvent: { data } }), {
      loader: undefined,
    });

    const resultPromise = runner("return json", 1, {});
    sandbox.receive(providerMessageFromInjection(injectJavaScript.mock.calls.at(-1)?.[0]));

    await expect(resultPromise).rejects.toBeInstanceOf(PythonRuntimeUnavailableError);
  });

  it("answers requests queued before and sent after a failed load", async () => {
    const { onMessage, runner } = mountProvider();
    let failLoad: (err: Error) => void = () => undefined;
    const sandbox = bootSandbox((data) => onMessage({ nativeEvent: { data } }), {
      loader: () =>
        new Promise((_resolve, reject) => {
          failLoad = reject;
        }),
    });

    const queued = runner("return json", 1, {});
    sandbox.receive(providerMessageFromInjection(injectJavaScript.mock.calls.at(-1)?.[0]));
    failLoad(new Error("network down"));
    await expect(queued).rejects.toBeInstanceOf(PythonRuntimeUnavailableError);

    const later = runner("return json", 2, {});
    sandbox.receive(providerMessageFromInjection(injectJavaScript.mock.calls.at(-1)?.[0]));
    await expect(later).rejects.toBeInstanceOf(PythonRuntimeUnavailableError);
  });

  it("gives up on a request while the runtime is still downloading", async () => {
    vi.useFakeTimers();
    const { onMessage, runner } = mountProvider();
    const sandbox = bootSandbox((data) => onMessage({ nativeEvent: { data } }), {
      loader: () => new Promise(() => undefined),
    });

    const resultPromise = runner("return json", 1, {});
    sandbox.receive(providerMessageFromInjection(injectJavaScript.mock.calls.at(-1)?.[0]));
    const settled = expect(resultPromise).rejects.toBeInstanceOf(PythonRuntimeUnavailableError);
    vi.advanceTimersByTime(30_000);

    await settled;

    // The next request fails at once rather than spinning for another timeout.
    const injectionsBefore = injectJavaScript.mock.calls.length;
    await expect(runner("return json", 2, {})).rejects.toBeInstanceOf(
      PythonRuntimeUnavailableError,
    );
    expect(injectJavaScript.mock.calls.length).toBe(injectionsBefore);
  });
});

describe("PythonMacroProvider falsy input boundary", () => {
  it("embeds the exported listener in the WebView HTML", () => {
    expect(pythonMacroSandboxHtml).toContain(`<script>\n${pythonMacroSandboxScript}\n</script>`);
  });

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
