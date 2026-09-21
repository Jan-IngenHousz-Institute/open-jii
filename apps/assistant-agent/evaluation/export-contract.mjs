import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  SYSTEM_PROMPT,
  TOOLS,
} = require("../../backend/dist/src/assistant/core/assistant-model.contract.js");
if (typeof SYSTEM_PROMPT !== "string" || !Array.isArray(TOOLS)) {
  throw new Error("Build the backend before exporting its assistant contract.");
}
const contract = { systemPrompt: SYSTEM_PROMPT, tools: TOOLS };
const sha256 = createHash("sha256").update(JSON.stringify(contract)).digest("hex");
const output = JSON.stringify({ ...contract, sha256 }, null, 2) + "\n";
const destination = new URL("./contract.json", import.meta.url);
if (process.argv.includes("--check")) {
  if (
    JSON.stringify(JSON.parse(readFileSync(destination, "utf8"))) !==
    JSON.stringify({ ...contract, sha256 })
  ) {
    throw new Error("Evaluation contract is stale. Re-export after building the backend.");
  }
} else {
  writeFileSync(destination, output);
}
console.log(`Assistant evaluation contract: ${sha256}`);
