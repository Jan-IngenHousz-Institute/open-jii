// Writes a routes-only copy of the contract for the browser. The oRPC client
// needs each procedure's route, not its schemas, which would otherwise ship zod
// and every schema in the API to every page.
const fs = require("node:fs");
const path = require("node:path");
const { minifyContractRouter } = require("@orpc/contract");

const { contract } = require("../dist/contract.js");

const dist = path.join(__dirname, "..", "dist");

// Unchanged files are left alone, so the dev watcher, which reruns this on any change in dist, settles.
function writeIfChanged(file, lines) {
  const target = path.join(dist, file);
  const content = lines.join("\n");
  if (fs.existsSync(target) && fs.readFileSync(target, "utf8") === content) {
    return;
  }
  fs.writeFileSync(target, content);
}

writeIfChanged("contract-routes.js", [
  '"use strict";',
  'Object.defineProperty(exports, "__esModule", { value: true });',
  `exports.contractRoutes = ${JSON.stringify(minifyContractRouter(contract))};`,
  "",
]);

writeIfChanged("contract-routes.d.ts", [
  'import type { AnyContractRouter } from "@orpc/contract";',
  "",
  "export declare const contractRoutes: AnyContractRouter;",
  "",
]);
