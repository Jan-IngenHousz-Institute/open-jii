import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
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

interface ShapeFingerprintFields {
  typeof: string;
  isArray: boolean;
  length: number | null;
  topLevelKeys: string[];
  setIsArray: boolean;
  setLength: number | null;
  setLabels: string[];
}

interface ShapeFingerprintFixtures {
  fixtureVersion: number;
  privacySentinels: string[];
  cases: {
    name: string;
    data: unknown;
    assertRoundTrip?: boolean;
    expected: ShapeFingerprintFields;
  }[];
}

const shapeFingerprintFixtures = JSON.parse(
  readFileSync(
    resolve(__dirname, "../../../packages/api/fixtures/macro-input-shape-fingerprints.json"),
    "utf8",
  ),
) as ShapeFingerprintFixtures;

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
const containerByLanguage = new Map<string, string>();

function readFingerprint(logs: string, macroId: string): Record<string, unknown> {
  const lines = logs.split("\n");
  const needle = `"macro_id":"${macroId}"`;
  let line: string | undefined;
  for (let index = lines.length - 1; index >= 0; index--) {
    const candidate = lines[index];
    if (candidate.includes(needle)) {
      line = candidate;
      break;
    }
  }
  if (!line) throw new Error(`No fingerprint found for ${macroId}`);
  const jsonStart = line.indexOf("{");
  if (jsonStart === -1) throw new Error(`Fingerprint line contained no JSON: ${line}`);
  return JSON.parse(line.slice(jsonStart)) as Record<string, unknown>;
}

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
      containerByLanguage.set(spec.language, name);
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

      it.each(shapeFingerprintFixtures.cases)(
        "forwards the canonical value-free $name fingerprint to container logs",
        async ({ name: fixtureName, data, assertRoundTrip, expected }) => {
          const fixtureId = fixtureName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
          const macroId = `macro-fingerprint-${spec.language}-${fixtureId}`;
          const workbookVersionId = `workbook-fingerprint-${spec.language}-${fixtureId}`;

          const response = await invoke(spec.port, {
            script: b64(spec.echoScript),
            items: [
              {
                id: `fingerprint-${fixtureId}`,
                macro_id: macroId,
                workbook_version_id: workbookVersionId,
                data,
              },
            ],
            timeout: 10,
          });

          expect(response.status).toBe("success");
          if (assertRoundTrip) {
            expect(response.results[0]?.output?.seen).toEqual(data);
          }
          const containerName = containerByLanguage.get(spec.language);
          if (!containerName) throw new Error(`Missing container for ${spec.language}`);
          const logResult = spawnSync("docker", ["logs", containerName], { encoding: "utf8" });
          const logs = `${logResult.stdout}${logResult.stderr}`;
          expect(readFingerprint(logs, macroId)).toEqual({
            msg: "Macro input shape fingerprint",
            operation: "executeMacro",
            boundary: "sandbox-pre-execution",
            ...expected,
            macro_id: macroId,
            workbook_version_id: workbookVersionId,
          });
          for (const sentinel of shapeFingerprintFixtures.privacySentinels) {
            expect(logs).not.toContain(sentinel);
          }
          expect(logs.toLowerCase()).not.toContain("\\ud83d\\ude00");
        },
      );
    });
  }
});
