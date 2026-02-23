/**
 * Lambda handler for JavaScript macro execution.
 *
 * Event schema:
 * {
 *   "script": "base64-encoded JS script",
 *   "items": [{"id": "item-1", "data": {...}}, ...],
 *   "timeout": 10,
 *   "protocol_id": "proto-123"
 * }
 */

const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Limits
const MAX_SCRIPT_SIZE = 1 * 1024 * 1024; // 1MB
const MAX_ITEM_COUNT = 1000;
const MAX_TIMEOUT = 60;
const DEFAULT_TIMEOUT = 10;

const WRAPPER_PATH = "/var/task/wrappers/wrapper.js";

/**
 * Clean up stale macro temp dirs from previous invocations.
 * On warm starts, /tmp persists. If a prior invocation crashed
 * (OOM, SIGKILL) before finally could run, stale files remain.
 */
function cleanupStaleTmp() {
  try {
    const tmpBase = os.tmpdir();
    for (const entry of fs.readdirSync(tmpBase)) {
      if (entry.startsWith("macro_")) {
        fs.rmSync(path.join(tmpBase, entry), { recursive: true, force: true });
      }
    }
  } catch {
    // Best-effort cleanup — don't fail the invocation
  }
}

exports.handler = async (event) => {
  let tmpdir;

  try {
    // Clean up stale temp dirs from any prior crashed invocation
    cleanupStaleTmp();
    // Validate script
    if (!event.script) {
      return { status: "error", results: [], errors: ["Missing 'script' field"] };
    }

    const scriptBytes = Buffer.from(event.script, "base64");
    if (scriptBytes.length > MAX_SCRIPT_SIZE) {
      return { status: "error", results: [], errors: ["Script exceeds 1MB limit"] };
    }
    const scriptContent = scriptBytes.toString("utf8");

    // Validate items
    const items = event.items || [];
    if (!Array.isArray(items)) {
      return { status: "error", results: [], errors: ["'items' must be an array"] };
    }
    if (items.length > MAX_ITEM_COUNT) {
      return {
        status: "error",
        results: [],
        errors: [`Exceeds ${MAX_ITEM_COUNT} item limit`],
      };
    }

    const timeout = Math.min(parseInt(event.timeout) || DEFAULT_TIMEOUT, MAX_TIMEOUT);

    // Write temp files
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "macro_"));
    const scriptPath = path.join(tmpdir, "script");
    const inputPath = path.join(tmpdir, "input.json");

    fs.writeFileSync(scriptPath, scriptContent, { mode: 0o600 });
    fs.writeFileSync(inputPath, JSON.stringify(items), { mode: 0o600 });

    // Execute wrapper as subprocess
    // Minimal environment — no AWS credentials, no Lambda internals
    const result = await new Promise((resolve) => {
      execFile(
        "node",
        [WRAPPER_PATH, scriptPath, inputPath],
        {
          timeout: (timeout + 5) * 1000,
          env: {
            PATH: "/var/lang/bin:/usr/local/bin:/usr/bin:/bin",
            HOME: "/tmp",
            NODE_PATH: "/var/task",
          },
          maxBuffer: 10 * 1024 * 1024, // 10MB output buffer
        },
        (error, stdout, stderr) => {
          if (error && error.killed) {
            resolve({ status: "error", results: [], errors: ["Execution timed out"] });
            return;
          }

          const output = (stdout || "").trim();
          if (output) {
            try {
              resolve(JSON.parse(output));
            } catch {
              resolve({
                status: "error",
                results: [],
                errors: ["Wrapper returned invalid JSON"],
              });
            }
          } else {
            resolve({
              status: "error",
              results: [],
              errors: ["Wrapper returned no output"],
            });
          }
        },
      );
    });

    return result;
  } catch (e) {
    return {
      status: "error",
      results: [],
      errors: [`Handler error: ${e.constructor.name}`],
    };
  } finally {
    if (tmpdir) {
      fs.rmSync(tmpdir, { recursive: true, force: true });
    }
  }
};
