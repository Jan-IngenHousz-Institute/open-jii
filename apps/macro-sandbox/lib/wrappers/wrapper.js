const fs = require("fs");
const vm = require("vm");

// 1. PATHS
const args = process.argv.slice(2);
const scriptPath = args[0];
const inputPath = args[1];

if (!scriptPath || !inputPath) {
  console.log(
    JSON.stringify({
      status: "error",
      results: [],
      errors: ["Missing required arguments: expected <script_path> and <input_path>"],
    }),
  );
  process.exit(0);
}

// 2. LOAD HELPERS
let helpersCode = "";
try {
  const path = require("path");
  const helpersPath = path.join(__dirname, "../src/helpers/helpers.js");
  helpersCode = fs.readFileSync(helpersPath, "utf8");
} catch (e) {
  console.log(
    JSON.stringify({
      status: "error",
      results: [],
      errors: [`Failed to load helpers: ${e.message}`],
    }),
  );
  process.exit(0);
}

// 3. READ DATA & SCRIPT
let batchItems = [];
let userCode = "";

try {
  const inputContent = fs.readFileSync(inputPath, "utf8");
  batchItems = JSON.parse(inputContent);
  userCode = fs.readFileSync(scriptPath, "utf8");
} catch (e) {
  console.log(JSON.stringify({ status: "error", results: [], errors: [`IO Error: ${e.message}`] }));
  process.exit(0);
}

// Wrap user code in a function to allow top-level 'return' statements
const wrappedCode = `
function executeMacro() {
${userCode}
}
var macroResult = executeMacro();
if (macroResult !== undefined) {
    output = macroResult;
}
`;

// A macro can throw any value. One thrown from the sandbox context is not an instance of this
// realm's Error, so the message is read by shape. Reading it can throw too, for an object with no
// prototype or a throwing getter, and that must still fail only the macro's own item.
function errorMessage(thrown) {
  try {
    if (thrown !== null && typeof thrown === "object" && typeof thrown.message === "string") {
      return thrown.message;
    }
    return String(thrown);
  } catch {
    return "the macro threw a value that cannot be read as an error message";
  }
}

// 4. CREATE CONTEXT ONCE
// The sandbox is given no host values. Every object a macro can reach, including its input
// data, belongs to the context's own realm, so `.constructor` leads to the context's Function,
// which `codeGeneration.strings: false` stops from compiling source. Passing a host object in
// (even a plain `{}` or the input data) would hand back a host prototype whose constructor is
// the host Function, which that flag does not restrain.
const context = vm.createContext(Object.create(null), {
  codeGeneration: {
    strings: false,
    wasm: false,
  },
});

// Set up the realm from inside it and hand the host back the few entry points it needs. These
// close over this realm's intrinsics captured before any macro runs, so a macro reassigning a
// global like `JSON` or `Object` cannot redirect how the next item is loaded or read back.
const BOOTSTRAP = `(() => {
  "use strict";
  const create = Object.create;
  const freeze = Object.freeze;
  const keys = Object.keys;
  const isArray = Array.isArray;
  const parse = JSON.parse;
  const stringify = JSON.stringify;

  // Macro stdout must not break the wrapper's single JSON line on stdout.
  globalThis.console = { log() {}, error() {}, warn() {}, info() {}, debug() {}, trace() {} };

  // Keep the macro surface deterministic, as it was before isolation: no wall clock. Timers and
  // the module system are already absent from a bare context; this removes the one realm intrinsic
  // that would otherwise reappear.
  globalThis.Date = undefined;

  // Freeze this realm's own intrinsics so one item cannot alter a shared prototype the next
  // item relies on.
  freeze(Object.prototype);
  freeze(Array.prototype);
  freeze(String.prototype);
  freeze(Number.prototype);
  freeze(Boolean.prototype);
  freeze(Function.prototype);
  freeze(Math);

  const deepFreeze = (value) => {
    if (isArray(value)) return freeze(value.map(deepFreeze));
    if (value !== null && typeof value === "object") {
      const obj = create(null);
      for (const key of keys(value)) obj[key] = deepFreeze(value[key]);
      return freeze(obj);
    }
    return value;
  };

  return {
    // Load one item's data as fresh realm objects and reset its output slot.
    setItem(dataStr, ctxStr) {
      const data = parse(dataStr);
      globalThis.json = data;
      globalThis.input_data = parse(dataStr);
      globalThis.ctx = ctxStr === null ? create(null) : deepFreeze(parse(ctxStr));
      globalThis.output = create(null);
    },
    // Serialise inside the realm; throws here fail only the item, as a bad output should.
    readOutput() {
      return stringify(globalThis.output);
    },
  };
})();`;

let runtime;
try {
  runtime = vm.runInContext(BOOTSTRAP, context, { displayErrors: false });
} catch (e) {
  console.log(
    JSON.stringify({
      status: "error",
      results: [],
      errors: [`Sandbox setup failed: ${e.message}`],
    }),
  );
  process.exit(0);
}

try {
  vm.runInContext(helpersCode, context);
} catch (e) {
  console.log(
    JSON.stringify({ status: "error", results: [], errors: [`Helper setup failed: ${e.message}`] }),
  );
  process.exit(0);
}

let script;
try {
  script = new vm.Script(wrappedCode);
} catch (e) {
  console.log(
    JSON.stringify({
      status: "error",
      results: [],
      errors: [`Script compilation failed: ${e.message}`],
    }),
  );
  process.exit(0);
}

let results = [];

// 5. EXECUTION LOOP
for (const item of batchItems) {
  try {
    runtime.setItem(
      JSON.stringify(item.data ?? null),
      item.context ? JSON.stringify(item.context) : null,
    );

    script.runInContext(context, { timeout: 1000, displayErrors: false });

    let outputJson;
    try {
      outputJson = runtime.readOutput();
    } catch (e) {
      throw new Error(`output cannot be sent as JSON: ${errorMessage(e)}`);
    }

    // An output that serialises to nothing (a function, undefined, a symbol) is dropped rather
    // than failing the item, the same as when the envelope was serialised whole.
    results.push({
      id: item.id,
      success: true,
      output: outputJson === undefined ? undefined : JSON.parse(outputJson),
    });
  } catch (e) {
    results.push({
      id: item.id,
      success: false,
      error: errorMessage(e),
    });
  }
}

// 6. OUTPUT
console.log(JSON.stringify({ status: "success", results: results }));
