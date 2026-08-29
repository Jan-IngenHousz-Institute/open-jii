import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { envByKey, envManifest } from "./env-manifest.js";
import { renderEnvExample } from "./generate-env.js";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const sourceRoots = [
  "apps/backend/src",
  "apps/web",
  "packages/analytics/src",
  "packages/api/src",
  "packages/auth/src",
  "packages/cms/src",
  "packages/database/src",
  "packages/i18n/src",
  "packages/iot/src",
  "packages/transactional/src",
  "packages/ui/src",
];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const sdkOnlyEnv = new Set([
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_PROFILE",
  "AWS_EC2_METADATA_DISABLED",
]);

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return ["node_modules", "dist", ".next", "test", "tests", "__tests__", "scripts"].includes(
          entry.name,
        )
          ? []
          : sourceFiles(path);
      }
      return sourceExtensions.has(extname(entry.name)) && !/\.(spec|test)\.[^.]+$/.test(entry.name)
        ? [path]
        : [];
    }),
  );
  return nested.flat();
}

function envReads(source: string): Set<string> {
  const keys = new Set<string>();
  const sourceFile = ts.createSourceFile(
    "environment-read.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  function isProcessEnv(node: ts.Node): boolean {
    let expression = node;
    while (ts.isParenthesizedExpression(expression)) expression = expression.expression;
    return (
      ts.isPropertyAccessExpression(expression) &&
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === "process" &&
      expression.name.text === "env"
    );
  }

  function addKey(key: string): void {
    if (/^[A-Z][A-Z0-9_]*$/.test(key)) keys.add(key);
  }

  function visit(node: ts.Node): void {
    if (ts.isPropertyAccessExpression(node) && isProcessEnv(node.expression)) {
      addKey(node.name.text);
    } else if (ts.isElementAccessExpression(node) && isProcessEnv(node.expression)) {
      const argument = node.argumentExpression;
      if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
        addKey(argument.text);
      }
    } else if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer &&
      isProcessEnv(node.initializer)
    ) {
      for (const element of node.name.elements) {
        const property = element.propertyName ?? element.name;
        if (ts.isIdentifier(property) || ts.isStringLiteral(property)) addKey(property.text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return keys;
}

describe("environment manifest", () => {
  it("matches the committed generated examples", async () => {
    await expect(readFile(join(root, "apps/backend/.env.example"), "utf8")).resolves.toBe(
      renderEnvExample("backend"),
    );
    await expect(readFile(join(root, "apps/web/.env.example"), "utf8")).resolves.toBe(
      renderEnvExample("web"),
    );
  });

  it("leaves optional firmware repositories unset locally", () => {
    const backendExample = renderEnvExample("backend");

    expect(backendExample).not.toMatch(/^FIRMWARE_REPO_(AMBYTE|AMBIT|MINIPAR)=/m);
  });

  it("contains every in-scope application environment read", async () => {
    expect(envManifest).toHaveLength(82);
    expect(envByKey.size).toBe(envManifest.length);
    expect(
      envReads("const url = `https://host/${process.env.URL_KEY}`; // process.env.NOPE"),
    ).toEqual(new Set(["URL_KEY"]));
    expect(
      envReads(`
        const direct = process.env.DIRECT;
        const bracket = process.env["BRACKET"];
        const optional = process.env?.OPTIONAL;
        const optionalElement = process.env?.["OPTIONAL_ELEMENT"];
        const commented = process.env /* comment */ .COMMENTED;
        const { DEFAULTED = "fallback", ALIASED: alias = "fallback" } = process.env;
        // process.env.LINE_COMMENT
        /* process.env.BLOCK_COMMENT */
      `),
    ).toEqual(
      new Set([
        "DIRECT",
        "BRACKET",
        "OPTIONAL",
        "OPTIONAL_ELEMENT",
        "COMMENTED",
        "DEFAULTED",
        "ALIASED",
      ]),
    );

    const files = (
      await Promise.all(sourceRoots.map((path) => sourceFiles(join(root, path))))
    ).flat();
    const missing = new Map<string, string[]>();
    for (const file of files) {
      for (const key of envReads(await readFile(file, "utf8"))) {
        if (!envByKey.has(key) && !sdkOnlyEnv.has(key)) {
          missing.set(key, [...(missing.get(key) ?? []), relative(root, file)]);
        }
      }
    }
    expect(Object.fromEntries(missing)).toEqual({});
  }, 30_000);
});
