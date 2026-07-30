import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in: exercises the real handlers and wrappers inside their Lambda containers.
// Run with `pnpm test:container`.
const ENABLED = process.env.MACRO_SB_CONTAINER === "1";
const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(__dirname, "..");

const INVOKE_PATH = "/2015-03-31/functions/function/invocations";

interface LangSpec {
  language: string;
  image: string;
  dockerfile: string;
  port: number;
  echoScript: string;
  isolationScript: string;
}

// Unique localhost tags rebuilt every run, so stale images cannot satisfy the suite.
const LANGS: LangSpec[] = [
  {
    language: "javascript",
    image: "localhost/macro-sandbox-passthrough-js",
    dockerfile: "functions/javascript/Dockerfile",
    port: 9101,
    echoScript: 'output["seen"] = json',
    isolationScript: 'if (json["fail"]) throw new Error("boom"); output["tag"] = json["tag"]',
  },
  {
    language: "python",
    image: "localhost/macro-sandbox-passthrough-py",
    dockerfile: "functions/python/Dockerfile",
    port: 9102,
    echoScript: 'output["seen"] = json',
    isolationScript:
      'if json.get("fail"):\n    raise ValueError("boom")\noutput["tag"] = json["tag"]',
  },
  {
    language: "r",
    image: "localhost/macro-sandbox-passthrough-r",
    dockerfile: "functions/r/Dockerfile.local",
    port: 9103,
    echoScript: "output$seen <- json; invisible(NULL)",
    isolationScript: 'if (isTRUE(json$fail)) stop("boom"); output$tag <- json$tag',
  },
];

function b64(s: string): string {
  return Buffer.from(s, "utf8").toString("base64");
}

function dockerAvailable(): boolean {
  return spawnSync("docker", ["--version"], { encoding: "utf8" }).status === 0;
}

function buildImage(spec: LangSpec): void {
  const build = spawnSync("docker", ["build", "-f", spec.dockerfile, "-t", spec.image, "."], {
    cwd: appDir,
    encoding: "utf8",
  });
  if (build.status !== 0) {
    throw new Error(`docker build failed for ${spec.language}: ${build.stderr || build.stdout}`);
  }
}

function runContainer(name: string, image: string, port: number): void {
  spawnSync("docker", ["rm", "-f", name], { encoding: "utf8" });
  const res = spawnSync("docker", ["run", "-d", "--name", name, "-p", `${port}:8080`, image], {
    encoding: "utf8",
  });
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

async function invoke(port: number, event: unknown): Promise<Envelope> {
  const res = await fetch(`http://localhost:${port}${INVOKE_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  const raw = (await res.json()) as { encoding?: string; payload?: string };
  if (raw.encoding === "gzip+base64" && typeof raw.payload === "string") {
    return JSON.parse(gunzipSync(Buffer.from(raw.payload, "base64")).toString("utf8")) as Envelope;
  }
  return raw as unknown as Envelope;
}

async function waitReady(port: number, event: unknown, attempts = 90): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      await invoke(port, event);
      return;
    } catch {
      await new Promise((resolveReady) => setTimeout(resolveReady, 1000));
    }
  }
  throw new Error(`container on port ${port} never became ready`);
}

const containers: string[] = [];

describe.skipIf(!ENABLED)("handler container data contract", () => {
  beforeAll(async () => {
    if (!dockerAvailable()) {
      throw new Error("MACRO_SB_CONTAINER=1 but Docker is unavailable");
    }
    for (const spec of LANGS) {
      buildImage(spec);
      const name = `mstest-${spec.language}-passthrough`;
      runContainer(name, spec.image, spec.port);
      containers.push(name);
      await waitReady(spec.port, {
        script: b64(spec.echoScript),
        items: [{ id: "warm", data: { ready: true } }],
        timeout: 10,
      });
    }
  }, 900_000);

  afterAll(() => {
    for (const name of containers) spawnSync("docker", ["rm", "-f", name], { encoding: "utf8" });
  });

  for (const spec of LANGS) {
    describe(spec.language, () => {
      it("passes every JSON root type unchanged and does not reshape sample envelopes", async () => {
        const values: unknown[] = [
          { kind: "object", nested: { value: 1 } },
          {},
          42,
          null,
          [{ value: 1 }],
          [{ value: 1 }, { value: 2 }],
          [],
          [1, 2],
          { sample: [{ value: 1 }, { value: 2 }] },
        ];
        const items = values.map((data, index) => ({ id: `value-${index}`, data }));

        const response = await invoke(spec.port, {
          script: b64(spec.echoScript),
          items,
          timeout: 10,
        });

        expect(response.status).toBe("success");
        expect(response.results).toHaveLength(values.length);
        expect(response.results.map((result) => result.id)).toEqual(items.map((item) => item.id));
        expect(response.results.map((result) => result.success)).toEqual(values.map(() => true));
        expect(response.results.map((result) => result.output?.seen)).toEqual(values);
      });

      it("isolates per-item failures while preserving order and duplicate or empty IDs", async () => {
        const response = await invoke(spec.port, {
          script: b64(spec.isolationScript),
          items: [
            { id: "dup", data: { tag: "first" } },
            { id: "dup", data: { tag: "failed", fail: true } },
            { id: "", data: { tag: "third" } },
            { id: "dup", data: { tag: "fourth" } },
          ],
          timeout: 10,
        });

        expect(response.status).toBe("success");
        expect(response.results.map((result) => result.id)).toEqual(["dup", "dup", "", "dup"]);
        expect(response.results.map((result) => result.success)).toEqual([true, false, true, true]);
        expect(response.results[0]?.output).toEqual({ tag: "first" });
        expect(response.results[1]?.error).toContain("boom");
        expect(response.results[2]?.output).toEqual({ tag: "third" });
        expect(response.results[3]?.output).toEqual({ tag: "fourth" });
      });
    });
  }
});
