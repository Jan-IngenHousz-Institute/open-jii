#!/usr/bin/env tsx
/**
 * Extract a compiled test case into a generate/ directory for editing.
 * This is the reverse of generate.ts — it decodes the base64 script and
 * writes macro.{py,js,R}, input.json, expectations.json, and output.json.
 *
 * Usage:
 *   pnpm test:edit <name>          # extract and open in editor
 *   pnpm test:edit <name> --no-open  # extract only, don't open
 */
import { execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = __dirname;
const GENERATE_DIR = join(__dirname, "generate");

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";

const DATASETS = ["samples", "intensive", "security"] as const;

const EXT_MAP: Record<string, string> = { python: "py", javascript: "js", r: "R" };

interface TestEntry {
  name: string;
  language: string;
  script: string; // base64
  items: { id: string; data: Record<string, unknown> }[];
  timeout: number;
  protocol_id: string;
  expect: { success: boolean; error: boolean; output?: Record<string, unknown>[] };
}

const LANG_SUFFIX: Record<string, string> = { python: "py", javascript: "js", r: "r" };

function loadEntries(name: string): { dataset: string; entry: TestEntry }[] {
  const results: { dataset: string; entry: TestEntry }[] = [];
  for (const dataset of DATASETS) {
    const path = join(DATA_DIR, `${dataset}.json`);
    if (!existsSync(path)) continue;
    const entries: TestEntry[] = JSON.parse(readFileSync(path, "utf-8"));
    for (const entry of entries) {
      if (entry.name === name) results.push({ dataset, entry });
    }
  }
  return results;
}

function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("-")));
  const name = args[0];
  const noOpen = flags.has("--no-open");

  if (!name) {
    console.log(`\n${BOLD}Usage:${RESET} pnpm test:edit <name>`);
    console.log(`${DIM}Extracts a compiled test case into generate/<name>/ for editing.${RESET}`);
    console.log(`${DIM}Run pnpm test:view to see available names.${RESET}\n`);
    process.exit(1);
  }

  const results = loadEntries(name);
  if (results.length === 0) {
    console.error(`${RED}Test case not found: ${name}${RESET}`);
    console.error(`${DIM}Run pnpm test:view to see available test cases.${RESET}`);
    process.exit(1);
  }

  // Multi-language: suffix dir names with language abbreviation
  const multiLang = results.length > 1;
  const allFiles: string[] = [];

  for (const { dataset, entry } of results) {
    const suffix = multiLang ? `_${LANG_SUFFIX[entry.language] ?? entry.language}` : "";
    const dirName = `${name}${suffix}`;
    const dir = join(GENERATE_DIR, dirName);
    const ext = EXT_MAP[entry.language] ?? "py";
    const macroFile = `macro.${ext}`;

    // Check if already extracted
    if (existsSync(dir)) {
      console.log(`${YELLOW}generate/${dirName}/${RESET} already exists — skipping extraction.`);
    } else {
      mkdirSync(dir, { recursive: true });

      // macro script (decode base64)
      const script = Buffer.from(entry.script, "base64").toString("utf-8");
      writeFileSync(join(dir, macroFile), script, "utf-8");

      // input.json
      writeFileSync(join(dir, "input.json"), JSON.stringify(entry.items, null, 2) + "\n", "utf-8");

      // expectations.json
      const expectations: Record<string, unknown> = {
        dataset,
        success: entry.expect.success,
        error: entry.expect.error,
      };
      if (entry.timeout !== 10) expectations.timeout = entry.timeout;
      if (entry.protocol_id !== `test-${dataset}-${name}`) {
        expectations.protocol_id = entry.protocol_id;
      }
      if (multiLang) {
        expectations.name = name;
      }
      writeFileSync(
        join(dir, "expectations.json"),
        JSON.stringify(expectations, null, 2) + "\n",
        "utf-8",
      );

      // output.json (if present)
      if (entry.expect.output) {
        writeFileSync(
          join(dir, "output.json"),
          JSON.stringify(entry.expect.output, null, 2) + "\n",
          "utf-8",
        );
      }

      console.log(
        `\n${GREEN}${BOLD}Extracted${RESET} ${CYAN}${dirName}${RESET} ${DIM}(${entry.language}, ${dataset})${RESET}\n`,
      );
      console.log(`  ${DIM}├─${RESET} ${macroFile}`);
      console.log(`  ${DIM}├─${RESET} input.json`);
      console.log(`  ${DIM}├─${RESET} expectations.json`);
      if (entry.expect.output) {
        console.log(`  ${DIM}└─${RESET} output.json`);
      } else {
        console.log(`  ${DIM}└─${RESET} ${DIM}(no output.json)${RESET}`);
      }
    }

    // Collect files for opening
    allFiles.push(join(dir, macroFile), join(dir, "expectations.json"));
  }

  // Open files in editor
  if (!noOpen) {
    const editor = process.env.EDITOR;
    if (editor) {
      execSync(`${editor} ${allFiles.map((f) => `"${f}"`).join(" ")}`, { stdio: "inherit" });
    } else {
      for (const f of allFiles) {
        const uri = `vscode://file/${encodeURI(f)}`;
        const cmd =
          process.platform === "darwin"
            ? `open "${uri}"`
            : process.platform === "win32"
              ? `start "" "${uri}"`
              : `xdg-open "${uri}"`;
        execSync(cmd, { stdio: "inherit" });
      }
    }
  }

  console.log(`\n${DIM}Edit the files, then run:${RESET} pnpm test:generate\n`);
}

main();
