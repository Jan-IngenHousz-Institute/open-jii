#!/usr/bin/env tsx
/**
 * Pretty-print a test case from the compiled JSON test data.
 *
 * Usage:
 *   pnpm test:view            # list all test cases
 *   pnpm test:view <name>     # view a specific test case
 */
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = __dirname;

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const ITALIC = "\x1b[3m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const MAGENTA = "\x1b[35m";
const BLUE = "\x1b[34m";
const WHITE = "\x1b[37m";

const DATASETS = ["samples", "intensive", "security"] as const;

function header(label: string) {
  console.log(`\n${CYAN}${BOLD}── ${label} ${"─".repeat(Math.max(0, 60 - label.length))}${RESET}`);
}

function jsonHighlight(text: string): string {
  return text
    .replace(/"([^"]+)":/g, `${CYAN}"$1"${RESET}:`)
    .replace(/: "(.*?)"/g, `: ${GREEN}"$1"${RESET}`)
    .replace(/: (true)/g, `: ${GREEN}$1${RESET}`)
    .replace(/: (false)/g, `: ${RED}$1${RESET}`)
    .replace(/: (\d+\.?\d*)/g, `: ${YELLOW}$1${RESET}`);
}

// ── Script syntax highlighting ───────────────────────────────

const PY_KEYWORDS =
  /\b(and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|None|True|False)\b/g;
const JS_KEYWORDS =
  /\b(async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|function|if|import|in|instanceof|let|new|of|return|super|switch|this|throw|try|typeof|var|void|while|with|yield|true|false|null|undefined)\b/g;
const R_KEYWORDS =
  /\b(if|else|repeat|while|function|for|in|next|break|TRUE|FALSE|NULL|NA|NA_integer_|NA_real_|NA_complex_|NA_character_|Inf|NaN|return|library|require)\b/g;

function highlightScript(code: string, language: string): string {
  const lines = code.split("\n");
  return lines
    .map((line) => {
      // Comments
      if (language === "python" || language === "r") {
        const commentIdx = line.indexOf("#");
        if (commentIdx !== -1) {
          const before = line.slice(0, commentIdx);
          const comment = line.slice(commentIdx);
          return highlightLine(before, language) + `${DIM}${ITALIC}${comment}${RESET}`;
        }
      }
      if (language === "javascript") {
        const commentIdx = line.indexOf("//");
        if (commentIdx !== -1) {
          const before = line.slice(0, commentIdx);
          const comment = line.slice(commentIdx);
          return highlightLine(before, language) + `${DIM}${ITALIC}${comment}${RESET}`;
        }
      }
      return highlightLine(line, language);
    })
    .join("\n");
}

function highlightLine(line: string, language: string): string {
  const kwRegex = language === "python" ? PY_KEYWORDS : language === "r" ? R_KEYWORDS : JS_KEYWORDS;

  return (
    line
      // Strings (single and double quoted)
      .replace(/(["'])(?:(?!\1|\\).|\\.)*\1/g, `${GREEN}$&${RESET}`)
      // Numbers
      .replace(/\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/gi, `${YELLOW}$1${RESET}`)
      // Keywords
      .replace(kwRegex, `${MAGENTA}${BOLD}$1${RESET}`)
      // Function calls
      .replace(/\b([a-zA-Z_]\w*)\s*\(/g, `${BLUE}$1${RESET}(`)
      // Operators
      .replace(/([=!<>]=?|[+\-*/%]|&&|\|\||=>|<-|\$)/g, `${WHITE}$1${RESET}`)
  );
}

// ── Types ────────────────────────────────────────────────────

interface TestEntry {
  name: string;
  language: string;
  script: string; // base64
  items: { id: string; data: Record<string, unknown> }[];
  timeout: number;
  protocol_id: string;
  expect: { success: boolean; error: boolean; output?: Record<string, unknown>[] };
}

// ── Load compiled JSON entries ───────────────────────────────

function loadAll(): Map<string, { dataset: string; entry: TestEntry }> {
  const map = new Map<string, { dataset: string; entry: TestEntry }>();
  for (const dataset of DATASETS) {
    const path = join(DATA_DIR, `${dataset}.json`);
    if (!existsSync(path)) continue;
    const entries: TestEntry[] = JSON.parse(readFileSync(path, "utf-8"));
    for (const entry of entries) {
      map.set(entry.name, { dataset, entry });
    }
  }
  return map;
}

// ── List ─────────────────────────────────────────────────────

function listAll() {
  const all = loadAll();

  if (all.size === 0) {
    console.log(`\n${DIM}No compiled test data. Run: pnpm test:generate${RESET}\n`);
    process.exit(0);
  }

  for (const dataset of DATASETS) {
    const entries = [...all.entries()].filter(([, v]) => v.dataset === dataset);
    if (entries.length === 0) continue;

    const color = dataset === "security" ? RED : dataset === "intensive" ? YELLOW : GREEN;
    console.log(`\n${BOLD}${color}${dataset}${RESET} ${DIM}(${entries.length} tests)${RESET}\n`);

    for (const [name, { entry }] of entries.sort((a, b) => a[0].localeCompare(b[0]))) {
      const ok = entry.expect.success ? `${GREEN}success${RESET}` : `${RED}fail${RESET}`;
      console.log(`  ${MAGENTA}${name}${RESET}  ${DIM}${entry.language}${RESET}  ${ok}`);
    }
  }

  console.log(`\n${DIM}Usage: pnpm test:view <name>${RESET}\n`);
}

// ── View ─────────────────────────────────────────────────────

function view(name: string, dataset: string, entry: TestEntry) {
  const color = dataset === "security" ? RED : dataset === "intensive" ? YELLOW : GREEN;
  console.log(
    `\n${BOLD}${name}${RESET}  ${DIM}${entry.language} · ${color}${dataset}${RESET}  ${DIM}(${entry.protocol_id})${RESET}`,
  );

  // Script (decode base64)
  header(`Script  (${entry.language})`);
  const script = Buffer.from(entry.script, "base64").toString("utf-8").trimEnd();
  console.log(highlightScript(script, entry.language));

  // Input (items)
  header(`Input  (${entry.items.length} item${entry.items.length !== 1 ? "s" : ""})`);
  console.log(jsonHighlight(JSON.stringify(entry.items, null, 2)));

  // Expectations
  header("Expectations");
  const exp: Record<string, unknown> = {
    success: entry.expect.success,
    error: entry.expect.error,
    timeout: entry.timeout,
  };
  console.log(jsonHighlight(JSON.stringify(exp, null, 2)));

  // Expected output
  if (entry.expect.output) {
    header(
      `Expected Output  (${entry.expect.output.length} item${entry.expect.output.length !== 1 ? "s" : ""})`,
    );
    console.log(jsonHighlight(JSON.stringify(entry.expect.output, null, 2)));
  } else {
    console.log(`\n${DIM}(no expected output)${RESET}`);
  }

  console.log();
}

// ── main ─────────────────────────────────────────────────────

function main() {
  const name = process.argv[2];

  if (!name) {
    listAll();
    process.exit(0);
  }

  const all = loadAll();
  const match = all.get(name);
  if (!match) {
    console.error(`${RED}Test case not found: ${name}${RESET}`);
    console.error(`${DIM}Run pnpm test:view to see available test cases.${RESET}`);
    process.exit(1);
  }

  view(name, match.dataset, match.entry);
}

main();
