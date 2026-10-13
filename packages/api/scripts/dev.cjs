// Watches the package with tsc and rewrites the routes-only contract after each clean compile.
// tsc runs as this process's child, so stopping dev stops both.
const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");
const readline = require("node:readline");

const writeRoutes = path.join(__dirname, "write-contract-routes.cjs");

const tsc = spawn("tsc", ["--watch", "--preserveWatchOutput"], {
  stdio: ["ignore", "pipe", "inherit"],
});

// Read by line: a chunk can end in the middle of tsc's summary.
readline.createInterface({ input: tsc.stdout }).on("line", (line) => {
  process.stdout.write(`${line}\n`);
  if (line.includes("Found 0 errors")) {
    spawnSync(process.execPath, [writeRoutes], { stdio: "inherit" });
  }
});

tsc.on("exit", (code) => process.exit(code ?? 0));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => tsc.kill(signal));
}
