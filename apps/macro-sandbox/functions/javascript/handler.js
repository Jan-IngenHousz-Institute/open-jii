const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const zlib = require("zlib");

const { guardBatch, partitionItems, mergeResults } = require(
  path.join(__dirname, "guards", "guard.js"),
);

// Shadow classifies and logs only; enforce rejects non-canonical items. Shadow
// is the default so this release does not change execution (Ticket 02).
function guardMode() {
  return process.env.MACRO_GUARD_MODE === "enforce" ? "enforce" : "shadow";
}

// AWS Lambda sync responses are capped at 6 MB. Compress every response so
// macro outputs of ~25-50 MB raw can still fit. Callers detect the
// {encoding, payload} wrapper and decompress.
function compressResponse(envelope) {
  const json = JSON.stringify(envelope);
  return {
    encoding: "gzip+base64",
    payload: zlib.gzipSync(json).toString("base64"),
  };
}

// Limits
const MAX_SCRIPT_SIZE = 1 * 1024 * 1024; // 1MB
const MAX_ITEM_COUNT = 1000;
const MAX_TIMEOUT = 60;
const DEFAULT_TIMEOUT = 10;

const WRAPPER_PATH = "/var/task/wrappers/wrapper.js";

// Warm-start cleanup: remove leftover temp dirs from crashed invocations.
function cleanupStaleTmp() {
  try {
    const tmpBase = os.tmpdir();
    for (const entry of fs.readdirSync(tmpBase)) {
      if (entry.startsWith("macro_")) {
        fs.rmSync(path.join(tmpBase, entry), { recursive: true, force: true });
      }
    }
  } catch {
    // best-effort
  }
}

exports.handler = async (event) => {
  const result = await _runMacroBatch(event);
  return compressResponse(result);
};

async function _runMacroBatch(event) {
  let tmpdir;

  try {
    cleanupStaleTmp();
    // Validate script
    if (!event.script) {
      return { status: "error", results: [], errors: ["Missing 'script' field"] };
    }

    // Node's Buffer.from silently ignores invalid base64 chars; round-trip check catches corruption.
    const scriptBytes = Buffer.from(event.script, "base64");
    if (scriptBytes.toString("base64") !== event.script) {
      return { status: "error", results: [], errors: ["Invalid base64 in 'script'"] };
    }
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

    const timeout = Math.max(
      DEFAULT_TIMEOUT,
      Math.min(parseInt(event.timeout) || DEFAULT_TIMEOUT, MAX_TIMEOUT),
    );

    // Contract guard. Shadow classifies + logs; execution is unchanged.
    const mode = guardMode();
    const guard = guardBatch({ input_contract: event.input_contract, items }, mode);
    console.error("[guard] " + JSON.stringify(guard.telemetry));

    let execItems = items;
    let invalidResults = [];
    if (mode === "enforce") {
      if (!guard.markerValid) {
        return { status: "error", results: [], errors: [guard.markerError] };
      }
      const partitioned = partitionItems(items, guard.decisions);
      execItems = partitioned.validItems;
      invalidResults = partitioned.invalidResults;
    }

    // Write temp files
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "macro_"));
    const scriptPath = path.join(tmpdir, "script");
    const inputPath = path.join(tmpdir, "input.json");

    fs.writeFileSync(scriptPath, scriptContent, { mode: 0o600 });
    fs.writeFileSync(inputPath, JSON.stringify(execItems), { mode: 0o600 });

    // Run wrapper in a subprocess with a stripped environment.
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
          // maxBuffer overflow can fire without setting error.killed/error.signal,
          // so check the code first.
          if (error?.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
            resolve({
              status: "error",
              results: [],
              errors: ["Wrapper output exceeds 10MB limit"],
            });
            return;
          }
          if (error && error.killed) {
            resolve({
              status: "error",
              results: [],
              errors: ["Execution timed out"],
            });
            return;
          }

          const output = (stdout || "").trim();
          if (output) {
            try {
              resolve(JSON.parse(output));
            } catch (parseErr) {
              const code = error?.code ?? "unknown";
              const signal = error?.signal ?? "none";
              // Stderr goes to CloudWatch via console.error, not into the
              // response. The response propagates into the macro_error column
              // downstream and shouldn't carry server internals.
              const stderrTrimmed = (stderr || "").trim();
              if (stderrTrimmed) {
                console.error("[handler] wrapper stderr:", stderrTrimmed.slice(0, 4000));
              }
              resolve({
                status: "error",
                results: [],
                errors: [
                  `Wrapper returned invalid JSON (parse: ${parseErr.message}; exit: ${code}; signal: ${signal}; stdoutLen: ${output.length}; stderrLen: ${stderrTrimmed.length})`,
                ],
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

    // Reassemble pre-failed items with wrapper results in request order.
    if (mode === "enforce" && result.status === "success") {
      if (!Array.isArray(result.results) || result.results.length !== execItems.length) {
        return {
          status: "error",
          results: [],
          errors: ["Wrapper result count mismatch"],
        };
      }
      return {
        status: "success",
        results: mergeResults(guard.decisions, result.results, invalidResults),
      };
    }

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
}
