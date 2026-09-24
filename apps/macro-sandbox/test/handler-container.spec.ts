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

const PYTHON_PORT = 9102;

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
    port: PYTHON_PORT,
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

function runContainer(name: string, image: string, port: number, options: string[] = []): void {
  spawnSync("docker", ["rm", "-f", name], { encoding: "utf8" });
  const args = ["run", "-d", "--name", name, "-p", `${port}:8080`, ...options, image];
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

  describe("python libraries", () => {
    const port = PYTHON_PORT;

    it("gives a macro that names np, scipy, pd or their helpers what those libraries compute", async () => {
      // Savitzky-Golay returns a straight line unchanged; the moving-average fallback bends its ends.
      const script = [
        'output["max"] = float(np.max([1, 5, 2]))',
        'output["slope"] = MathLINREG([1, 2, 3, 4], [3, 5, 7, 9])["m"]',
        'output["smoothed"] = TransformTrace("sgf", [1, 2, 3, 4, 5, 6, 7])',
        'output["t"] = float(scipy.stats.ttest_1samp([1, 2, 3], 0).statistic)',
        'output["total"] = int(pd.Series([1, 2, 3]).sum())',
      ].join("\n");

      const response = await invoke(port, {
        script: b64(script),
        items: [{ id: "libraries", data: {} }],
        timeout: 10,
      });

      const output = response.results[0]?.output;
      expect(response.results[0]?.success).toBe(true);
      expect(output?.max).toBe(5);
      expect(output?.slope).toBeCloseTo(2);
      expect(output?.t).toBeCloseTo(2 * Math.sqrt(3));
      expect(output?.total).toBe(6);
      expect(output?.smoothed).toEqual([
        expect.closeTo(1),
        expect.closeTo(2),
        expect.closeTo(3),
        expect.closeTo(4),
        expect.closeTo(5),
        expect.closeTo(6),
        expect.closeTo(7),
      ]);
    });

    it("runs a macro that names none of them", async () => {
      const response = await invoke(port, {
        script: b64('output["mean"] = MathMEAN([1, 2, 3])'),
        items: [{ id: "plain", data: {} }],
        timeout: 10,
      });

      expect(response.results[0]).toEqual({ id: "plain", success: true, output: { mean: 2 } });
    });

    describe("on a quarter of a core", () => {
      const throttledPort = 9104;

      beforeAll(async () => {
        const name = "mstest-python-throttled";
        runContainer(name, "localhost/macro-sandbox-passthrough-py", throttledPort, [
          "--cpus=0.25",
        ]);
        containers.push(name);
        await waitReady(throttledPort, {
          script: b64('output["ready"] = True'),
          items: [{ id: "warm", data: {} }],
          timeout: 30,
        });
      }, 300_000);

      it("loads the SciPy that pandas imports on its own before an item's one-second timer", async () => {
        // Kendall correlation and spline interpolation make pandas import SciPy itself.
        const script = [
          'output["tau"] = float(pd.Series([1, 2, 3, 4]).corr(pd.Series([1, 3, 2, 4]), method="kendall"))',
          'output["filled"] = pd.Series([1.0, None, 3.0]).interpolate(method="spline", order=1).tolist()',
        ].join("\n");

        const response = await invoke(throttledPort, {
          script: b64(script),
          items: [{ id: "pandas-scipy", data: {} }],
          timeout: 30,
        });

        expect(response.results[0]?.error).toBeUndefined();
        expect(response.results[0]?.output?.tau).toBeCloseTo(2 / 3);
        expect(response.results[0]?.output?.filled).toEqual([
          expect.closeTo(1),
          expect.closeTo(2),
          expect.closeTo(3),
        ]);
      });
    });
  });
});
