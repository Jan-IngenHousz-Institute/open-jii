import { onlineManager } from "@tanstack/react-query";
import { act, render } from "@testing-library/react-native";
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

const { injectJavaScript, webViewProps, webViewMounts } = vi.hoisted(() => ({
  injectJavaScript: vi.fn(),
  webViewProps: vi.fn(),
  webViewMounts: vi.fn(),
}));

vi.mock("react-native-webview", () => ({
  default: React.forwardRef((props: Record<string, unknown>, ref) => {
    webViewProps(props);
    React.useImperativeHandle(ref, () => ({ injectJavaScript }));
    React.useEffect(() => {
      webViewMounts();
    }, []);
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

function lastInjectedMessage(): string {
  const source: unknown = injectJavaScript.mock.calls.at(-1)?.[0];
  if (typeof source !== "string") {
    throw new Error("Nothing was injected into the WebView");
  }
  return providerMessageFromInjection(source);
}

afterEach(() => {
  vi.useRealTimers();
  onlineManager.setOnline(true);
  registerPythonMacroRunner(null);
  injectJavaScript.mockReset();
  webViewProps.mockClear();
  webViewMounts.mockClear();
});

describe("PythonMacroProvider without a runtime", () => {
  it("answers a request sent while the runtime script fails to load", async () => {
    const { onMessage, runner } = mountProvider();

    // Sent before the page reports back, so it reaches the sandbox, which answers it.
    const resultPromise = runner("return json", 1, {});
    const sandbox = bootSandbox((data) => onMessage({ nativeEvent: { data } }), {
      loader: undefined,
    });
    sandbox.receive(lastInjectedMessage());

    await expect(resultPromise).rejects.toBeInstanceOf(PythonRuntimeUnavailableError);
  });

  it("answers queued requests when the load fails, and later ones without the page", async () => {
    const { onMessage, runner } = mountProvider();
    let failLoad: (err: Error) => void = () => undefined;
    const sandbox = bootSandbox((data) => onMessage({ nativeEvent: { data } }), {
      loader: () =>
        new Promise((_resolve, reject) => {
          failLoad = reject;
        }),
    });

    const queued = runner("return json", 1, {});
    sandbox.receive(lastInjectedMessage());
    failLoad(new Error("network down"));
    await expect(queued).rejects.toBeInstanceOf(PythonRuntimeUnavailableError);

    const injectionsBefore = injectJavaScript.mock.calls.length;
    await expect(runner("return json", 2, {})).rejects.toBeInstanceOf(
      PythonRuntimeUnavailableError,
    );
    expect(injectJavaScript.mock.calls.length).toBe(injectionsBefore);
  });

  it("gives up on a request while the runtime is still downloading", async () => {
    vi.useFakeTimers();
    const { onMessage, runner } = mountProvider();
    const sandbox = bootSandbox((data) => onMessage({ nativeEvent: { data } }), {
      loader: () => new Promise(() => undefined),
    });

    const resultPromise = runner("return json", 1, {});
    sandbox.receive(lastInjectedMessage());
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

  it("reloads a runtime that failed to load once the connection returns", async () => {
    const { onMessage, runner } = mountProvider();
    bootSandbox((data) => onMessage({ nativeEvent: { data } }), { loader: undefined });
    await expect(runner("return json", 1, {})).rejects.toBeInstanceOf(
      PythonRuntimeUnavailableError,
    );

    act(() => {
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
    });
    expect(webViewMounts).toHaveBeenCalledTimes(2);

    const reloaded = bootSandbox((data) => onMessage({ nativeEvent: { data } }));
    const resultPromise = runner("return json", 7, {});
    reloaded.receive(lastInjectedMessage());

    await expect(resultPromise).resolves.toEqual({ echo: 7 });
  });

  it("leaves a runtime that is still loading alone when the connection returns", () => {
    mountProvider();

    act(() => {
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
    });

    expect(webViewMounts).toHaveBeenCalledTimes(1);
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
