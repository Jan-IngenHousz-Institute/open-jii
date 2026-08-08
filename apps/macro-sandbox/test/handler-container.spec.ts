import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in: exercises the real handlers and wrappers inside their Lambda containers.
// Run with `pnpm test:container`.
const ENABLED = process.env.MACRO_SB_CONTAINER === "1";
const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(__dirname, "..");
const fixturePath = resolve(
  __dirname,
  "../../../packages/api/fixtures/macro-input-shape-fingerprints.json",
);

const INVOKE_PATH = "/2015-03-31/functions/function/invocations";

interface LangSpec {
  language: string;
  image: string;
  dockerfile: string;
  port: number;
  echoScript: string;
  isolationScript: string;
  fingerprintScript: string;
  failureScript: string;
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
    fingerprintScript: 'output["ok"] = true',
    failureScript: 'throw new Error("expected failure")',
  },
  {
    language: "python",
    image: "localhost/macro-sandbox-passthrough-py",
    dockerfile: "functions/python/Dockerfile",
    port: 9102,
    echoScript: 'output["seen"] = json',
    isolationScript:
      'if json.get("fail"):\n    raise ValueError("boom")\noutput["tag"] = json["tag"]',
    fingerprintScript: 'output["ok"] = True',
    failureScript: 'raise ValueError("expected failure")',
  },
  {
    language: "r",
    image: "localhost/macro-sandbox-passthrough-r",
    dockerfile: "functions/r/Dockerfile.local",
    port: 9103,
    echoScript: "output$seen <- json; invisible(NULL)",
    isolationScript: 'if (isTRUE(json$fail)) stop("boom"); output$tag <- json$tag',
    fingerprintScript: "output$ok <- TRUE; invisible(NULL)",
    failureScript: 'stop("expected failure")',
  },
];

interface FingerprintFixture {
  fixtureVersion: number;
  privacySentinels: string[];
  cases: Array<{
    name: string;
    data: unknown;
    expected: Record<string, unknown>;
  }>;
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

interface WrapperEnvelope extends Envelope {
  fingerprints: Array<Record<string, unknown>>;
}

const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as FingerprintFixture;

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

function fixtureItems() {
  return fixture.cases.map((testCase, index) => ({
    id: `row-${index}`,
    macro_id: `macro-${index}`,
    workbook_version_id: "workbook-version-456",
    data: testCase.data,
  }));
}

function expectedFingerprints() {
  return fixture.cases.map((testCase, index) => ({
    msg: "Macro input shape fingerprint",
    operation: "executeMacro",
    boundary: "sandbox-pre-execution",
    ...testCase.expected,
    macro_id: `macro-${index}`,
    workbook_version_id: "workbook-version-456",
  }));
}

function runWrapperInContainer(
  spec: LangSpec,
  script = spec.fingerprintScript,
): {
  envelope: WrapperEnvelope;
  fingerprintJson: string;
  stderr: string;
} {
  const dir = mkdtempSync(resolve(tmpdir(), `macro-${spec.language}-wrapper-test-`));
  const scriptPath = resolve(dir, "script");
  const inputPath = resolve(dir, "input.json");
  writeFileSync(scriptPath, script, "utf8");
  writeFileSync(inputPath, JSON.stringify(fixtureItems()), "utf8");

  const runtime =
    spec.language === "javascript" ? "node" : spec.language === "python" ? "python3" : "Rscript";
  const extension = spec.language === "javascript" ? "js" : spec.language === "python" ? "py" : "R";
  const result = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "--entrypoint",
      runtime,
      "-e",
      "LC_CTYPE=C.UTF-8",
      "-v",
      `${scriptPath}:/tmp/macro-script:ro,Z`,
      "-v",
      `${inputPath}:/tmp/macro-input.json:ro,Z`,
      spec.image,
      `/var/task/wrappers/wrapper.${extension}`,
      "/tmp/macro-script",
      "/tmp/macro-input.json",
    ],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );
  rmSync(dir, { recursive: true, force: true });

  if (result.status !== 0) {
    throw new Error(
      `${spec.language} wrapper failed: ${result.stderr || result.stdout || `exit ${result.status}`}`,
    );
  }
  const stdout = result.stdout.trim();
  const fingerprintMatch = stdout.match(/"fingerprints":(\[.*\])}$/s);
  if (!fingerprintMatch?.[1]) {
    throw new Error(`${spec.language} wrapper omitted fingerprints: ${stdout}`);
  }
  return {
    envelope: JSON.parse(stdout) as WrapperEnvelope,
    fingerprintJson: fingerprintMatch[1],
    stderr: result.stderr.replace(
      /^Emulate Docker CLI using podman\. Create \/etc\/containers\/nodocker to quiet msg\.\r?\n/,
      "",
    ),
  };
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

  it("produces byte-identical fingerprints for the shared v2 fixture in every wrapper", () => {
    expect(fixture.fixtureVersion).toBe(2);
    const wrapperResults = LANGS.map(runWrapperInContainer);

    for (const result of wrapperResults) {
      expect(result.stderr).toBe("");
      expect(result.envelope.fingerprints).toEqual(expectedFingerprints());
      for (const sentinel of fixture.privacySentinels) {
        expect(result.fingerprintJson).not.toContain(sentinel);
      }
    }
    expect(new Set(wrapperResults.map((result) => result.fingerprintJson)).size).toBe(1);
  });

  it("keeps fixture fingerprints value-free when every macro item fails", () => {
    const wrapperResults = LANGS.map((spec) => runWrapperInContainer(spec, spec.failureScript));

    for (const result of wrapperResults) {
      expect(result.stderr).toBe("");
      expect(result.envelope.results.every((row) => row.success === false)).toBe(true);
      expect(result.envelope.fingerprints).toEqual(expectedFingerprints());
      for (const sentinel of fixture.privacySentinels) {
        expect(result.fingerprintJson).not.toContain(sentinel);
      }
    }
    expect(new Set(wrapperResults.map((result) => result.fingerprintJson)).size).toBe(1);
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
        expect(JSON.stringify(response)).not.toContain('"fingerprints"');
      });

      it("logs fixture fingerprints without returning them in the Lambda response", async () => {
        const response = await invoke(spec.port, {
          script: b64(spec.fingerprintScript),
          items: fixtureItems(),
          timeout: 10,
        });

        expect(response.status).toBe("success");
        expect(response.results).toHaveLength(fixture.cases.length);
        expect(JSON.stringify(response)).not.toContain('"fingerprints"');
      });
    });
  }

  it("does not forward successful JavaScript macro stderr to container logs", async () => {
    const secret = "JS_STDERR_SECRET_MUST_NOT_REACH_CLOUDWATCH";
    const response = await invoke(9101, {
      script: b64(
        `Object.constructor("return process")().stderr.write("${secret}\\n"); output["ok"] = true`,
      ),
      items: [{ id: "exploit-row", macro_id: "macro-exploit", data: { set: [] } }],
      timeout: 10,
    });

    expect(response.status).toBe("success");
    expect(response.results).toMatchObject([{ id: "exploit-row", success: true }]);
    expect(JSON.stringify(response)).not.toContain('"fingerprints"');

    const logs = spawnSync("docker", ["logs", "mstest-javascript-passthrough"], {
      encoding: "utf8",
    });
    expect(`${logs.stdout}\n${logs.stderr}`).not.toContain(secret);
  });
});
