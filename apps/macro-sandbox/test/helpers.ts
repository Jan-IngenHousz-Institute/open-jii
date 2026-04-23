// Data loading
import { createDecipheriv } from "crypto";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const INVOKE_PATH = "/2015-03-31/functions/function/invocations";

/** Port mapping per language (from .env.test, falling back to dev defaults) */
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

// Types

export interface TestExpectation {
  success: boolean;
  error: boolean;
  output?: Record<string, unknown>[];
}

/** A single test case from the generated JSON data files. */
export interface TestCase {
  name: string;
  language: string;
  script: string; // base64
  items: { id: string; data: Record<string, unknown> | unknown[] }[];
  timeout: number;
  protocol_id: string;
  expect: TestExpectation;
}

/** A single result item returned by the Lambda. */
export interface ResultItem {
  id: string;
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
}

/** Lambda response envelope. */
export interface LambdaResponse {
  status: "success" | "error";
  results: ResultItem[];
  errors?: string[];
}

// Invocation

/** Invoke a Lambda with the given test case payload. */
export async function invokeLambda(
  testCase: TestCase,
  options?: { timeoutMs?: number },
): Promise<{ response: LambdaResponse; status: number; durationMs: number }> {
  const { name: _, language, expect: _expect, ...payload } = testCase;

  // Decrypt script
  const aesKey = Buffer.from(process.env.MACRO_SB_TEST_KEY ?? "", "base64");
  const [ivHex, ctHex] = payload.script.split(":");
  const decipher = createDecipheriv("aes-256-cbc", aesKey, Buffer.from(ivHex, "hex"));
  payload.script = Buffer.concat([
    decipher.update(Buffer.from(ctHex, "hex")),
    decipher.final(),
  ]).toString("utf8");

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

// Route helpers

/** Languages a test case targets -- "all" maps to every runtime. */
export function targetLanguages(testCase: TestCase): string[] {
  if (testCase.language === "all") {
    return Object.keys(PORTS);
  }
  return [testCase.language];
}

/** Create a copy of a test case retargeted to a specific language. */
export function withLanguage(testCase: TestCase, language: string): TestCase {
  return { ...testCase, language };
}

// Assertions

/** Assert the response has the standard envelope shape. */
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
const dataDir = resolve(__dirname, "data");

export function loadTestData(file: string): TestCase[] {
  const raw = readFileSync(resolve(dataDir, file), "utf-8");
  return JSON.parse(raw) as TestCase[];
}
