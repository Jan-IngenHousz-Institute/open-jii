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

// 4. CREATE CONTEXT ONCE
// Minimal sandbox: no Date, performance, setTimeout, process, require, eval
const sandbox = {
  json: Object.create(null),
  input_data: Object.create(null),
  output: Object.create(null),
  console: { log: () => {} },
  Date: undefined,
  performance: undefined,
  setTimeout: undefined,
  setInterval: undefined,
  setImmediate: undefined,
  clearTimeout: undefined,
  clearInterval: undefined,
  clearImmediate: undefined,
  process: undefined,
  require: undefined,
  global: undefined,
  globalThis: undefined,
  Function: undefined,
  eval: undefined,
  Object: Object,
  Array: Array,
  String: String,
  Number: Number,
  Boolean: Boolean,
  Math: Math,
  JSON: Object.create(null, {
    parse: { value: JSON.parse, enumerable: true },
    stringify: { value: JSON.stringify, enumerable: true },
  }),
};

const context = vm.createContext(sandbox, {
  codeGeneration: {
    strings: false,
    wasm: false,
  },
});

Object.freeze(Object.prototype);
Object.freeze(Array.prototype);
Object.freeze(String.prototype);
Object.freeze(Number.prototype);
Object.freeze(Boolean.prototype);

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
  sandbox.json = Object.create(null);
  sandbox.input_data = Object.create(null);
  sandbox.output = Object.create(null);

  Object.assign(sandbox.json, item.data);
  Object.assign(sandbox.input_data, item.data);

  try {
    script.runInContext(context, { timeout: 1000, displayErrors: false });
    results.push({
      id: item.id,
      success: true,
      output: sandbox.output,
    });
  } catch (e) {
    results.push({
      id: item.id,
      success: false,
      error: e.message,
    });
  }
}

// 6. OUTPUT
console.log(JSON.stringify({ status: "success", results: results }));
