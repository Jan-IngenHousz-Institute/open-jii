#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { manifest } from "./manifest/index.js";
import { exitCodeForMode, renderConsoleReport, serializeReport } from "./report.js";
import { scanRepository } from "./scanner.js";

interface Options {
  mode: "report" | "strict";
  root: string;
  json: string;
}

function parseArgs(args: readonly string[]): Options {
  const options: Options = {
    mode: "report",
    root: resolve(import.meta.dirname, "../../.."),
    json: "tooling/device-nomenclature/reports/inventory.json",
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];
    if (argument === "--mode" && (value === "report" || value === "strict")) {
      options.mode = value;
      index += 1;
    } else if (argument === "--root" && value) {
      options.root = resolve(value);
      index += 1;
    } else if (argument === "--json" && value) {
      options.json = value;
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }
  return options;
}

export async function main(args = process.argv.slice(2)): Promise<number> {
  const options = parseArgs(args);
  const report = await scanRepository(options.root, manifest);
  const jsonPath = resolve(options.root, options.json);
  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, serializeReport(report), "utf8");
  process.stdout.write(renderConsoleReport(report));
  process.stdout.write(`JSON report: ${options.json.replaceAll("\\", "/")}\n`);
  return exitCodeForMode(report, options.mode);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      process.stderr.write(`Device nomenclature scanner error: ${String(error)}\n`);
      process.exitCode = 2;
    });
}
