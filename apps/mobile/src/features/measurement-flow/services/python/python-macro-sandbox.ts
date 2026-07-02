import { Asset } from "expo-asset";
import { File } from "expo-file-system";

import helpersResource from "./macro-helpers.py.txt";

// Helper names bound as globals for every macro, mirroring the server's
// wrapper.py. Without them a Python macro NameErrors on-device (e.g. `danger`).
export const MACRO_HELPER_NAMES = [
  "ArrayNth",
  "ArrayRange",
  "ArrayUnZip",
  "ArrayZip",
  "GetIndexByLabel",
  "GetLabelLookup",
  "GetProtocolByLabel",
  "MathLINREG",
  "MathLN",
  "MathLOG",
  "MathMAX",
  "MathMEAN",
  "MathMEDIAN",
  "MathMIN",
  "MathROUND",
  "MathSTDERR",
  "MathSTDEV",
  "MathSTDEVS",
  "MathSUM",
  "MathVARIANCE",
  "MathMULTREG",
  "MathEXPINVREG",
  "MathPOLYREG",
  "TransformTrace",
  "calcSunAngle",
  "info",
  "warning",
  "danger",
] as const;

// JS string literal safe to embed inside an HTML <script>: escaping `<` keeps a
// stray "</script>" in the helper source from closing the tag early.
function jsStringLiteral(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * Builds the Pyodide program for one macro run, matching wrapper.py: `json` is
 * the input row, `output` starts empty, and a dict return is merged into it.
 */
export function buildMacroProgram(code: string, jsonB64: string): string {
  const indented = code
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
  return [
    "import json as __jsonmod__, base64 as __b64__",
    `__json_input__ = __jsonmod__.loads(__b64__.b64decode("${jsonB64}").decode("utf-8"))`,
    "json = __json_input__",
    "output = {}",
    "def execute_macro():",
    indented,
    "",
    "__macro_result__ = execute_macro()",
    "if isinstance(__macro_result__, dict):",
    "    output.update(__macro_result__)",
    "__result_holder__.result = __jsonmod__.dumps(output)",
    "",
  ].join("\n");
}

// HTML for a hidden WebView running macros via Pyodide. Helpers are baked in and
// imported as an isolated module at init (so their `json`/`math` don't collide
// with the macro's `json`), then bound as globals.
export function buildPythonMacroSandboxHtml(helpersSource: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><title>Python Macro</title></head>
<body>
<script src="https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js"></script>
<script>
(function() {
  var pyodideReady = false;
  var pending = [];
  var HELPERS_SRC = ${jsStringLiteral(helpersSource)};
  var HELPER_NAMES = ${jsStringLiteral(MACRO_HELPER_NAMES.join(", "))};

  function send(obj) {
    if (window.ReactNativeWebView && ReactNativeWebView.postMessage) {
      ReactNativeWebView.postMessage(typeof obj === 'string' ? obj : JSON.stringify(obj));
    }
  }

  function indent(s) {
    return s.split('\\n').map(function(line) { return '    ' + line; }).join('\\n');
  }

  async function runMacro(requestId, code, json) {
    try {
      var resultHolder = {};
      pyodide.globals.set('__result_holder__', resultHolder);
      var jsonB64 = btoa(unescape(encodeURIComponent(JSON.stringify(json))));
      var wrapped =
        'import json as __jsonmod__, base64 as __b64__\\n' +
        '__json_input__ = __jsonmod__.loads(__b64__.b64decode("' + jsonB64 + '").decode("utf-8"))\\n' +
        'json = __json_input__\\n' +
        'output = {}\\n' +
        'def execute_macro():\\n' + indent(code) + '\\n\\n' +
        '__macro_result__ = execute_macro()\\n' +
        'if isinstance(__macro_result__, dict):\\n    output.update(__macro_result__)\\n' +
        '__result_holder__.result = __jsonmod__.dumps(output)\\n';
      await pyodide.runPythonAsync(wrapped);
      var raw = resultHolder.result;
      var str = (typeof raw === 'string') ? raw : (raw != null ? String(raw) : '');
      var jsResult = {};
      if (str) {
        try { jsResult = JSON.parse(str); } catch (e) {}
      }
      send({ requestId: requestId, result: jsResult });
    } catch (err) {
      send({ requestId: requestId, error: err.message || String(err) });
    }
  }

  window.addEventListener('message', function(event) {
    var data = event.data;
    try {
      var payload = typeof data === 'string' ? JSON.parse(data) : data;
      if (!payload || payload.requestId === undefined || payload.code === undefined) return;
      if (pyodideReady) {
        runMacro(payload.requestId, payload.code, payload.json || {});
      } else {
        pending.push(payload);
      }
    } catch (e) {
      // ignore parse errors; no requestId to report back
    }
  });

  loadPyodide().then(async function(pyodide) {
    window.pyodide = pyodide;
    // Define helpers as a module so their internal imports stay isolated, then
    // expose the functions as globals for the macro to call.
    pyodide.FS.writeFile('jii_macro_helpers.py', HELPERS_SRC);
    await pyodide.runPythonAsync(
      'import jii_macro_helpers\\n' +
      'from jii_macro_helpers import ' + HELPER_NAMES + '\\n'
    );
    pyodideReady = true;
    send({ type: 'ready' });
    pending.forEach(function(p) { runMacro(p.requestId, p.code, p.json || {}); });
    pending.length = 0;
  }).catch(function(err) {
    send({ type: 'error', message: err.message || String(err) });
    pending.forEach(function(p) {
      send({ requestId: p.requestId, error: 'Pyodide failed to load: ' + (err.message || err) });
    });
    pending.length = 0;
  });
})();
</script>
</body>
</html>
`;
}

async function loadHelpersSource(): Promise<string> {
  const asset = Asset.fromModule(helpersResource);
  await asset.downloadAsync();
  const path = asset.localUri ?? asset.uri;
  return await new File(path).text();
}

let htmlPromise: Promise<string> | null = null;

/** Loads the bundled helper source once and returns the ready-to-render HTML. */
export function getPythonMacroSandboxHtml(): Promise<string> {
  htmlPromise ??= loadHelpersSource().then(buildPythonMacroSandboxHtml);
  return htmlPromise;
}
