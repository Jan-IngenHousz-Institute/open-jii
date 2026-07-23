#!/usr/bin/env node
import { resolve } from "node:path";

import {
  formatFrozenHistoryViolation,
  frozenHistoryViolations,
  readFrozenHistoryChanges,
} from "./frozen-history.js";

interface Options {
  base: string;
  head: string;
  root: string;
}

function parseArgs(args: readonly string[]): Options {
  const options: Partial<Options> = {
    head: "HEAD",
    root: resolve(import.meta.dirname, "../../.."),
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];
    if (argument === "--base" && value) {
      options.base = value;
      index += 1;
    } else if (argument === "--head" && value) {
      options.head = value;
      index += 1;
    } else if (argument === "--root" && value) {
      options.root = resolve(value);
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }
  if (!options.base) throw new Error("Missing required argument: --base <git-revision>");
  return options as Options;
}

export async function main(args = process.argv.slice(2)): Promise<number> {
  const options = parseArgs(args);
  const changes = await readFrozenHistoryChanges(options.root, options.base, options.head);
  const violations = frozenHistoryViolations(changes);
  if (violations.length === 0) {
    process.stdout.write("Frozen history guard passed: no existing SQL or snapshot changed.\n");
    return 0;
  }

  process.stderr.write("Frozen history guard rejected changes to existing history:\n");
  for (const violation of violations) {
    process.stderr.write(`  ${formatFrozenHistoryViolation(violation)}\n`);
  }
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      process.stderr.write(`Frozen history guard error: ${String(error)}\n`);
      process.exitCode = 2;
    });
}
