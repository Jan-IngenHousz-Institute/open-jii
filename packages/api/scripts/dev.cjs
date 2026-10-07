// Watches the package with tsc and rewrites the routes-only contract after each clean compile.
// tsc runs as this process's child, so stopping dev stops both.
const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");

const writeRoutes = path.join(__dirname, "write-contract-routes.cjs");

const tsc = spawn("tsc", ["--watch", "--preserveWatchOutput"], {
  stdio: ["ignore", "pipe", "inherit"],
});

tsc.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  if (chunk.toString().includes("Found 0 errors")) {
    spawnSync(process.execPath, [writeRoutes], { stdio: "inherit" });
  }
});

tsc.on("exit", (code) => process.exit(code ?? 0));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => tsc.kill(signal));
}
