#!/usr/bin/env node
/**
 * Regression tripwire for the theme contract.
 *
 * Counts class strings that escape the contract and compares the totals against
 * `baseline.json`. **The baseline is the permanent floor, not a migration
 * target.** Lower it when you retire an exception; never raise it to make a
 * failure go away — a failure means a new escape landed.
 *
 * This began life as a ratchet during the theme migration and was kept once the
 * count reached its floor, because it does something the ESLint rule cannot.
 * The rule inspects string literals and template chunks, which is what you want
 * while editing a file. This reads the raw file text, so it also sees prose in
 * comments, and it is indifferent to how a class was written. During the sweep
 * it caught a `git checkout` that silently reverted five fixes in a tree full of
 * uncommitted work — something the full test suite passed straight through. The
 * two numbers are not meant to agree.
 *
 * It does not see everything either. A class assembled around an interpolation
 * (`bg-badge-${status}`) is invisible to both tools, which is why enum-shaped
 * classes come from a tone map rather than being built at the call site.
 *
 *   node ratchet.mjs            check against the floor
 *   node ratchet.mjs --write    re-record, only ever downward
 *
 * The floor is 15, and every one of them is a scrim or a foreground paired with
 * one. Four are the dialog, alert-dialog, drawer and sheet scrims in packages/ui,
 * which upstream shadcn ships as a fixed translucent dark wash rather than a
 * token. Two are the public navbar's topbar fade and its foreground; six are the
 * home hero's fade and the four foregrounds over it; three are the auth pages'
 * shared photo scrim. A scrim is theme-independent by design — it dims whatever
 * is behind it, identically in light and dark — and the contract has no slot for
 * one. A fixed scrim also has to carry its own foreground, or the pairing drifts
 * the next time a token moves. Each carries an inline disable saying so.
 *
 * The floor moves up only for a scrim, and only once the scrim has been hoisted
 * to a single definition — the auth scrim was four copies across four pages,
 * which would have cost twelve.
 *
 * Imported by relative path rather than as a workspace dependency: this is a
 * standalone script, and the eslint config is plain ESM with no build step.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { themeClassPatterns } from "../eslint/theme-tokens.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const baselinePath = path.join(here, "baseline.json");

/** Roots to scan, keyed by the name used in the baseline. */
const SCOPES = {
  "apps/web": ["app", "components", "hooks", "lib", "providers"],
  "packages/ui": ["src"],
  "packages/cms": ["src"],
};

const SKIP_DIRS = new Set(["node_modules", ".next", ".turbo", "dist", "coverage", "__generated"]);

function collectTsx(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collectTsx(path.join(dir, entry.name), out);
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      // `.ts` as well as `.tsx`: a tone map is a plain module, and two dead
      // utility classes lived in one for a whole ticket because the scan
      // stopped at components.
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

/** @returns {{counts: Record<string, Record<string, number>>, worst: Map<string, number>}} */
function measure() {
  const counts = {};
  const worst = new Map();

  for (const [scope, roots] of Object.entries(SCOPES)) {
    const files = roots.flatMap((root) => collectTsx(path.join(repoRoot, scope, root), []));
    const perPattern = {};
    for (const { id } of themeClassPatterns) perPattern[id] = 0;

    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      for (const { id, source } of themeClassPatterns) {
        const matches = text.match(new RegExp(source, "g"));
        if (!matches) continue;
        perPattern[id] += matches.length;
        const key = `${path.relative(repoRoot, file)}`;
        worst.set(key, (worst.get(key) ?? 0) + matches.length);
      }
    }
    counts[scope] = perPattern;
  }

  return { counts, worst };
}

const { counts, worst } = measure();
const total = Object.values(counts)
  .flatMap((byPattern) => Object.values(byPattern))
  .reduce((a, b) => a + b, 0);

if (process.argv.includes("--write")) {
  fs.writeFileSync(baselinePath, `${JSON.stringify({ total, counts }, null, 2)}\n`);
  console.log(`theme-guard: recorded baseline of ${total} occurrence(s).`);
  process.exit(0);
}

if (!fs.existsSync(baselinePath)) {
  console.error("theme-guard: no baseline.json — run `pnpm theme:baseline` to record one.");
  process.exit(1);
}

/** @type {{total: number, counts: Record<string, Record<string, number>>}} */
const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

const regressions = [];
for (const [scope, byPattern] of Object.entries(counts)) {
  for (const [id, count] of Object.entries(byPattern)) {
    const allowed = baseline.counts[scope]?.[id] ?? 0;
    if (count > allowed) regressions.push({ scope, id, count, allowed });
  }
}

if (regressions.length > 0) {
  console.error("theme-guard: class strings outside the theme contract increased.\n");
  for (const { scope, id, count, allowed } of regressions) {
    console.error(`  ${scope}  ${id}: ${count} (baseline ${allowed})`);
  }
  const offenders = [...worst.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.error("\n  Largest offenders overall:");
  for (const [file, count] of offenders)
    console.error(`    ${count.toString().padStart(4)}  ${file}`);
  console.error(
    "\n  Colours and fonts live in apps/web/app/globals.css. Use a contract token" +
      "\n  (bg-card, text-muted-foreground, border-border, …) or a --status-* token.",
  );
  process.exit(1);
}

if (total < baseline.total) {
  console.log(
    `theme-guard: ${baseline.total - total} occurrence(s) removed (${baseline.total} -> ${total}).\n` +
      "Run `pnpm --filter @repo/theme-guard theme:baseline` to lower the floor.",
  );
} else {
  console.log(`theme-guard: ${total} occurrence(s), at the baseline.`);
}
