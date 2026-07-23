import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { applyInputContract, INPUT_CONTRACT } from "./helpers.js";

// Opt-in: exercises the REAL handlers inside their Lambda containers. Skipped by
// default so `test:unit` stays Docker-free. Run with `pnpm test:container`.
// When enabled it FAILS CLOSED: missing Docker, a failed image build, or a
// runtime that never becomes ready fails the suite instead of skipping.
const ENABLED = process.env.MACRO_SB_CONTAINER === "1";
const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(__dirname, "..");

const INVOKE_PATH = "/2015-03-31/functions/function/invocations";

interface LangSpec {
  language: string;
  image: string;
  dockerfile: string;
  shadowPort: number;
  enforcePort: number;
  // Trivial macro that succeeds on any input.
  script: string;
  // Macro that echoes json.tag into output, to prove per-item output association.
  echoScript: string;
}

// Unique localhost tags rebuilt every run, so a stale same-named image can never
// be picked up (podman short-name resolution can otherwise shadow these).
const LANGS: LangSpec[] = [
  {
    language: "javascript",
    image: "localhost/macro-sandbox-guardtest-js",
    dockerfile: "functions/javascript/Dockerfile",
    shadowPort: 9101,
    enforcePort: 9201,
    script: 'output["ok"] = 1',
    echoScript: 'output["tag"] = json["tag"]',
  },
  {
    language: "python",
    image: "localhost/macro-sandbox-guardtest-py",
    dockerfile: "functions/python/Dockerfile",
    shadowPort: 9102,
    enforcePort: 9202,
    script: 'output["ok"] = 1',
    echoScript: 'output["tag"] = json["tag"]',
  },
  {
    language: "r",
    image: "localhost/macro-sandbox-guardtest-r",
    dockerfile: "functions/r/Dockerfile.local",
    shadowPort: 9103,
    enforcePort: 9203,
    script: "output$ok <- 1",
    echoScript: "output$tag <- json$tag",
  },
];

function b64(s: string): string {
  return Buffer.from(s, "utf8").toString("base64");
}

/** True only if `docker` runs and exits 0. A missing or failing binary is false. */
function dockerAvailable(): boolean {
  return spawnSync("docker", ["--version"], { encoding: "utf8" }).status === 0;
}

function buildImage(spec: LangSpec): void {
  // Always rebuild from current source; layer cache keeps this fast.
  const build = spawnSync("docker", ["build", "-f", spec.dockerfile, "-t", spec.image, "."], {
    cwd: appDir,
    encoding: "utf8",
  });
  if (build.status !== 0) {
    throw new Error(`docker build failed for ${spec.language}: ${build.stderr || build.stdout}`);
  }
}

function runContainer(name: string, image: string, port: number, enforce: boolean): void {
  spawnSync("docker", ["rm", "-f", name], { encoding: "utf8" });
  const args = ["run", "-d", "--name", name, "-p", `${port}:8080`];
  if (enforce) args.push("-e", "MACRO_GUARD_MODE=enforce");
  args.push(image);
  const res = spawnSync("docker", args, { encoding: "utf8" });
  if (res.status !== 0) throw new Error(`docker run ${name} failed: ${res.stderr}`);
}

interface ResultRow {
  id: string;
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
}
interface Envelope {
  status: string;
  results: ResultRow[];
  errors?: string[];
}

async function invokeRaw(port: number, body: string): Promise<Envelope> {
  const res = await fetch(`http://localhost:${port}${INVOKE_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const raw = (await res.json()) as { encoding?: string; payload?: string };
  if (raw.encoding === "gzip+base64" && typeof raw.payload === "string") {
    return JSON.parse(gunzipSync(Buffer.from(raw.payload, "base64")).toString("utf8")) as Envelope;
  }
  return raw as unknown as Envelope;
}

function invoke(port: number, event: unknown): Promise<Envelope> {
  return invokeRaw(port, JSON.stringify(event));
}

async function waitReady(port: number, event: unknown, attempts = 90): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      await invoke(port, event);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`container on port ${port} never became ready`);
}

function dockerLogs(name: string): string {
  const res = spawnSync("docker", ["logs", name], { encoding: "utf8" });
  return res.stdout + res.stderr;
}

const containers: string[] = [];

describe.skipIf(!ENABLED)("handler container contract", () => {
  beforeAll(async () => {
    // Fail closed: with the mode explicitly on, Docker must be present.
    if (!dockerAvailable()) {
      throw new Error("MACRO_SB_CONTAINER=1 but Docker is unavailable; failing closed");
    }
    const warmup = (spec: LangSpec) => ({
      input_contract: INPUT_CONTRACT,
      script: b64(spec.script),
      items: [{ id: "warm", data: { a: 1 } }],
      timeout: 10,
    });
    for (const spec of LANGS) {
      buildImage(spec);
      const shadowName = `mstest-${spec.language}-shadow`;
      const enforceName = `mstest-${spec.language}-enforce`;
      runContainer(shadowName, spec.image, spec.shadowPort, false);
      runContainer(enforceName, spec.image, spec.enforcePort, true);
      containers.push(shadowName, enforceName);
      await waitReady(spec.shadowPort, warmup(spec));
      await waitReady(spec.enforcePort, warmup(spec));
    }
  }, 900_000);

  afterAll(() => {
    for (const name of containers) spawnSync("docker", ["rm", "-f", name], { encoding: "utf8" });
  });

  for (const spec of LANGS) {
    describe(spec.language, () => {
      it("shadow: marked and unmarked (helper-omitted) events return identical results", async () => {
        const items = [
          { id: "a", data: { phi2: 0.8 } },
          { id: "b", data: { sample: [{ v: 1 }] } },
          { id: "c", data: [] as unknown[] },
        ];
        // Marker defaulted vs omitted, both through the shared helper path.
        const markedPayload = applyInputContract({
          input_contract: undefined as string | null | undefined,
          script: b64(spec.script),
          items,
          timeout: 10,
        });
        const unmarkedPayload = applyInputContract({
          input_contract: null as string | null | undefined,
          script: b64(spec.script),
          items,
          timeout: 10,
        });
        // The helper defaulted one and removed the marker from the other.
        expect(markedPayload.input_contract).toBe(INPUT_CONTRACT);
        expect("input_contract" in unmarkedPayload).toBe(false);

        const marked = await invoke(spec.shadowPort, markedPayload);
        const unmarked = await invoke(spec.shadowPort, unmarkedPayload);

        // Shadow runs every item unchanged, marker present or not.
        expect(marked.status).toBe("success");
        expect(marked.results.map((r) => [r.id, r.success])).toEqual([
          ["a", true],
          ["b", true],
          ["c", true],
        ]);
        expect(unmarked.results).toEqual(marked.results);
      });

      it("shadow: telemetry is visible and never echoes the marker value", async () => {
        const sentinel = "sentinel-marker-should-not-appear";
        await invoke(spec.shadowPort, {
          input_contract: sentinel,
          script: b64(spec.script),
          items: [{ id: "a", data: { phi2: 1 } }],
          timeout: 10,
        });
        const logs = dockerLogs(`mstest-${spec.language}-shadow`);
        expect(logs).toContain("[guard]");
        expect(logs).toContain('"markerPresent"');
        expect(logs).not.toContain(sentinel);
      });

      it("enforce: unsupported marker fails the whole invocation", async () => {
        const res = await invoke(spec.enforcePort, {
          input_contract: "canonical-measurement-v9",
          script: b64(spec.script),
          items: [{ id: "a", data: { phi2: 0.8 } }],
          timeout: 10,
        });
        expect(res.status).toBe("error");
        expect(res.errors).toContain("unsupported-input-contract");
      });

      it("enforce: complete distinguishable positional rows (outputs, dup/empty IDs, failures, order)", async () => {
        const res = await invoke(spec.enforcePort, {
          input_contract: INPUT_CONTRACT,
          script: b64(spec.echoScript),
          items: [
            { id: "dup", data: { tag: "t1" } },
            { id: "dup", data: { sample: [{ v: 1 }] } },
            { id: "", data: { tag: "t3" } },
            { id: "", data: [] as unknown[] },
          ],
          timeout: 10,
        });
        expect(res.status).toBe("success");
        expect(res.results).toHaveLength(4);
        // Distinct outputs prove each canonical result stayed at its own position.
        const normalized = res.results.map((r) =>
          r.success
            ? { id: r.id, success: true, output: r.output }
            : { id: r.id, success: false, error: r.error },
        );
        expect(normalized).toEqual([
          { id: "dup", success: true, output: { tag: "t1" } },
          { id: "dup", success: false, error: "non-canonical-input" },
          { id: "", success: true, output: { tag: "t3" } },
          { id: "", success: false, error: "empty-envelope" },
        ]);
      });

      it("enforce: an escaped sample key on the raw wire is treated as an envelope", async () => {
        // Literal raw body: the wire bytes contain sample, not sample, so the
        // R raw-parser path must decode the key before jsonlite reserialization.
        const rawBody = `{"input_contract":"${INPUT_CONTRACT}","script":"${b64(spec.script)}","timeout":10,"items":[{"id":"esc","data":{"\\u0073ample":[]}}]}`;
        expect(rawBody).toContain('"\\u0073ample"');
        expect(rawBody).not.toContain('"sample"');

        const res = await invokeRaw(spec.enforcePort, rawBody);
        expect(res.status).toBe("success");
        expect(res.results).toEqual([{ id: "esc", success: false, error: "empty-envelope" }]);
      });

      if (spec.language === "r") {
        const bomBody =
          "\uFEFF" +
          `{"input_contract":"${INPUT_CONTRACT}","script":"${b64(spec.script)}","timeout":10,"items":[{"id":"bom","data":{"phi2":0.8}}]}`;

        it("enforce: a raw-classifier count mismatch fails the invocation closed", async () => {
          expect(bomBody.startsWith("\uFEFF")).toBe(true);

          const res = await invokeRaw(spec.enforcePort, bomBody);
          expect(res.status).toBe("error");
          expect(res.results).toHaveLength(0);
          expect(res.errors).toContain("guard-classification-unavailable");
        });

        it("shadow: a raw-classifier count mismatch remains execution-neutral", async () => {
          expect(bomBody.startsWith("\uFEFF")).toBe(true);

          const res = await invokeRaw(spec.shadowPort, bomBody);
          expect(res.status).toBe("success");
          expect(res.results).toEqual([{ id: "bom", success: true, output: { ok: 1 } }]);
        });
      }
    });
  }
});
