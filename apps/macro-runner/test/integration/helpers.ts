// ── Data loading ─────────────────────────────────────────────
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ============================================================
// Integration Test Helpers — Lambda HTTP Client
// ============================================================
// Language-agnostic test helpers for invoking Lambda functions
// through the RIE (Runtime Interface Emulator) HTTP API.
// ============================================================

/** Lambda invoke endpoint template. RIE exposes this on each container's port. */
const INVOKE_PATH = "/2015-03-31/functions/function/invocations";

/** Port mapping per language — reads from env vars set by .env.test, falls back to dev defaults */
export const PORTS: Record<string, number> = {
  python: Number(process.env.PYTHON_PORT ?? 9001),
  javascript: Number(process.env.JAVASCRIPT_PORT ?? 9002),
  r: Number(process.env.R_PORT ?? 9003),
};

/** Base URL for a given language */
export function baseUrl(language: string): string {
  const port = PORTS[language];
  if (!port) throw new Error(`Unknown language: ${language}`);
  return `http://localhost:${port}`;
}

// ── Types ────────────────────────────────────────────────────

/** Expected outcome for a test case */
export interface TestExpectation {
  /** true = response.status must be "success"; false = must be "error" */
  success: boolean;
  /** true = at least one item has success=false or an "error" key */
  error: boolean;
  /** Per-item expected output (parallel to items array). Derived from snapshots. */
  output?: Record<string, unknown>[];
}

/** Shape of a single test case from the generated JSON data files */
export interface TestCase {
  name: string;
  language: string;
  script: string; // base64
  items: { id: string; data: Record<string, unknown> }[];
  timeout: number;
  protocol_id: string;
  expect: TestExpectation;
}

/** A single result item returned by the Lambda */
export interface ResultItem {
  id: string;
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
}

/** Lambda response envelope */
export interface LambdaResponse {
  status: "success" | "error";
  results: ResultItem[];
  errors?: string[];
}

// ── Invocation ───────────────────────────────────────────────

/**
 * Invoke a Lambda function with the given test case payload.
 * Strips `name` and `language` (test-only fields) before sending.
 */
export async function invokeLambda(
  testCase: TestCase,
  options?: { timeoutMs?: number },
): Promise<{ response: LambdaResponse; status: number; durationMs: number }> {
  const { name: _, language, expect: _expect, ...payload } = testCase;
  const url = `${baseUrl(language)}${INVOKE_PATH}`;
  const timeoutMs = options?.timeoutMs ?? (testCase.timeout + 30) * 1000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const body = (await res.json()) as LambdaResponse;
    const durationMs = performance.now() - start;

    return { response: body, status: res.status, durationMs };
  } finally {
    clearTimeout(timer);
  }
}

// ── Route helpers ────────────────────────────────────────────

/** Languages a test case targets — `"all"` maps to every runtime */
export function targetLanguages(testCase: TestCase): string[] {
  if (testCase.language === "all") {
    return Object.keys(PORTS);
  }
  return [testCase.language];
}

/**
 * Create a copy of a test case targeting a specific language.
 * Used when `language: "all"` should fan out to each runtime.
 */
export function withLanguage(testCase: TestCase, language: string): TestCase {
  return { ...testCase, language };
}

// ── Assertions ───────────────────────────────────────────────

/** Assert the response has the standard envelope shape */
export function assertValidEnvelope(response: LambdaResponse): void {
  if (typeof response !== "object") {
    throw new Error("Response is not an object");
  }
  if (!("status" in response)) {
    throw new Error('Response missing "status" field');
  }
  if (!Array.isArray(response.results)) {
    throw new Error('"results" is not an array');
  }
  if (response.status === "error" && !Array.isArray(response.errors)) {
    throw new Error('Error response missing "errors" array');
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, "../data");

export function loadTestData(file: string): TestCase[] {
  const raw = readFileSync(resolve(dataDir, file), "utf-8");
  return JSON.parse(raw) as TestCase[];
}
