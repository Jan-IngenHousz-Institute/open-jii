#!/usr/bin/env tsx
/**
 * Interactive CLI to scaffold a new test case directory in test/data/generate/.
 *
 * Usage:
 *   pnpm test:init
 *   npx tsx test/data/init.ts
 */
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { createInterface } from "readline";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATE_DIR = join(__dirname, "generate");

// ── ANSI helpers ─────────────────────────────────────────────

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";

function header(label: string) {
  console.log(`\n${CYAN}${BOLD}── ${label} ${"─".repeat(Math.max(0, 60 - label.length))}${RESET}`);
}

// ── readline helpers ─────────────────────────────────────────

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function choose<T extends string>(prompt: string, options: T[], fallback: T): Promise<T> {
  const display = options
    .map((o) => (o === fallback ? `${GREEN}${BOLD}${o}${RESET}` : `${DIM}${o}${RESET}`))
    .join(" / ");
  const answer = (await ask(`${prompt} (${display}): `)).trim().toLowerCase();
  if (answer === "") return fallback;
  const match = options.find((o) => o.toLowerCase() === answer);
  if (!match) {
    console.log(`  ${YELLOW}Invalid choice. Using default: ${fallback}${RESET}`);
    return fallback;
  }
  return match;
}

async function askBool(prompt: string, fallback: boolean): Promise<boolean> {
  const y = fallback ? `${GREEN}${BOLD}Y${RESET}` : `${DIM}y${RESET}`;
  const n = fallback ? `${DIM}n${RESET}` : `${GREEN}${BOLD}N${RESET}`;
  const answer = (await ask(`${prompt} (${y}/${n}): `)).trim().toLowerCase();
  if (answer === "") return fallback;
  return answer.startsWith("y");
}

async function askNumber(prompt: string, fallback: number): Promise<number> {
  const answer = (await ask(`${prompt} ${DIM}[${fallback}]${RESET}: `)).trim();
  if (answer === "") return fallback;
  const n = Number(answer);
  if (!Number.isFinite(n) || n <= 0) {
    console.log(`  ${YELLOW}Invalid number. Using default: ${fallback}${RESET}`);
    return fallback;
  }
  return n;
}

// ── macro templates ──────────────────────────────────────────

const TEMPLATES: Record<string, string> = {
  python: `\
# Available globals:
#   json    — item data (dict)
#   output  — result dict (write your outputs here)
#   np      — numpy
#   pd      — pandas
#   scipy   — scipy

output['result'] = json.get('value', 0)
`,
  javascript: `\
// Available globals:
//   json    — item data (object)
//   output  — result object (write your outputs here)

output.result = json.value || 0;
`,
  r: `\
# Available globals:
#   json    — item data (list)
#   output  — result list (write your outputs here)

output$result <- json$value
`,
};

// ── main ─────────────────────────────────────────────────────

async function main() {
  header("New macro-runner test case");
  console.log();

  // 1. Name
  let name = "";
  while (!name) {
    name = (await ask(`  ${BOLD}Name${RESET} ${DIM}(snake_case)${RESET}: `)).trim();
    if (!name) continue;
    if (!/^[a-z0-9_]+$/.test(name)) {
      console.log(`  ${RED}Use lowercase letters, numbers, and underscores only.${RESET}`);
      name = "";
      continue;
    }
    if (existsSync(join(GENERATE_DIR, name))) {
      console.log(`  ${RED}Directory generate/${name}/ already exists.${RESET}`);
      name = "";
    }
  }

  // 2. Language
  const language = await choose(
    `  ${BOLD}Language${RESET}`,
    ["python", "javascript", "r"],
    "python",
  );
  const ext = { python: "py", javascript: "js", r: "R" }[language];

  // 3. Dataset
  const dataset = await choose(
    `  ${BOLD}Dataset${RESET}`,
    ["samples", "intensive", "security"],
    "samples",
  );

  // 4. Expectations
  const success = await askBool(`  ${BOLD}Expect success?${RESET}`, true);
  const error = await askBool(`  ${BOLD}Expect item-level error?${RESET}`, false);
  const timeout = await askNumber(`  ${BOLD}Timeout${RESET} ${DIM}(seconds)${RESET}`, 10);

  // 5. Items
  const itemCount = await askNumber(`  ${BOLD}Number of input items${RESET}`, 1);

  rl.close();

  // ── create files ─────────────────────────────────────────

  const dir = join(GENERATE_DIR, name);
  mkdirSync(dir, { recursive: true });

  // macro
  writeFileSync(join(dir, `macro.${ext}`), TEMPLATES[language], "utf-8");

  // input.json
  const items = Array.from({ length: itemCount }, (_, i) => ({
    id: `item-${i + 1}`,
    data: {},
  }));
  writeFileSync(join(dir, "input.json"), JSON.stringify(items, null, 2) + "\n", "utf-8");

  // expectations.json
  const expectations: Record<string, unknown> = { dataset, success, error };
  if (timeout !== 10) expectations.timeout = timeout;
  writeFileSync(
    join(dir, "expectations.json"),
    JSON.stringify(expectations, null, 2) + "\n",
    "utf-8",
  );

  header("Created");
  console.log();
  console.log(`  ${GREEN}generate/${name}/${RESET}`);
  console.log(`    ${DIM}├─${RESET} macro.${ext}`);
  console.log(`    ${DIM}├─${RESET} input.json`);
  console.log(`    ${DIM}└─${RESET} expectations.json`);
  console.log();
  console.log(`  ${DIM}Next steps:${RESET}`);
  console.log(`    1. Edit the files      ${DIM}pnpm test:edit ${name}${RESET}`);
  console.log(`    2. Preview             ${DIM}pnpm test:view ${name}${RESET}`);
  console.log(`    3. Generate test data  ${DIM}pnpm test:generate${RESET}`);
  console.log();
}

main().catch((err) => {
  console.error(err);
  rl.close();
  process.exit(1);
});
