import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { aggregateManifest } from "./manifest/aggregate.js";
import { manifest as realManifest } from "./manifest/index.js";
import { exitCodeForMode, serializeReport } from "./report.js";
import { readTrackedFiles, scanTrackedFiles } from "./scanner.js";
import type { NomenclatureRule, RuleManifest, TrackedTextFile } from "./types.js";

function rule(overrides: Partial<NomenclatureRule> = {}): NomenclatureRule {
  return {
    id: "rule",
    surface: "mobile",
    category: "keep-product-specific",
    granularity: "content-pattern",
    paths: ["apps/mobile/**"],
    pattern: "multispeq",
    disposition: "preserve",
    target: "MultiSpeQ product behavior",
    rationale: "Test rule",
    compatibilityBoundary: null,
    ...overrides,
  };
}

function manifest(...rules: NomenclatureRule[]): RuleManifest {
  return { version: 1, rules };
}

function scan(files: TrackedTextFile[], ...rules: NomenclatureRule[]) {
  return scanTrackedFiles(files, manifest(...rules));
}

describe("device nomenclature scanner", () => {
  it("classifies path-preserved history wholesale without line allowlists", () => {
    const historyRule = rule({
      id: "history",
      surface: "database",
      category: "keep-generated-history",
      granularity: "path",
      paths: ["packages/database/drizzle/**"],
      pattern: undefined,
      disposition: "preserve",
      target: "frozen history",
      rationale: "Generated history is immutable",
      compatibilityBoundary: "database history",
      coversContents: true,
    });
    const report = scan(
      [{ path: "packages/database/drizzle/0001.sql", content: "\n\nmultispeq\nMultiSpeQ" }],
      historyRule,
    );

    expect(report.summary).toMatchObject({ classified: 2, nomenclatureIssues: 0 });
    expect(report.findings.every((finding) => finding.ruleIds[0] === "history")).toBe(true);
  });

  it("keeps generated-history classification stable under harmless line movement", () => {
    const historyRule = rule({
      id: "history",
      surface: "database",
      category: "keep-generated-history",
      granularity: "path",
      paths: ["packages/database/drizzle/**"],
      pattern: undefined,
      disposition: "preserve",
      target: "frozen history",
      rationale: "Generated history is immutable",
      compatibilityBoundary: "database history",
      coversContents: true,
    });
    const before = scan(
      [{ path: "packages/database/drizzle/0001.sql", content: "multispeq\nMultiSpeQ\n" }],
      historyRule,
    );
    const after = scan(
      [{ path: "packages/database/drizzle/0001.sql", content: "\n\nMultiSpeQ\nmultispeq\n" }],
      historyRule,
    );

    expect(after.summary).toEqual(before.summary);
    expect(after.findings.map(({ status, ruleIds }) => ({ status, ruleIds }))).toEqual(
      before.findings.map(({ status, ruleIds }) => ({ status, ruleIds })),
    );
    expect(after.deadRules).toEqual([]);
  });

  it("supports file, symbol/key, and content-pattern specificity", () => {
    const report = scan(
      [
        {
          path: "apps/mobile/mixed.ts",
          content: "const MultispeqCommandExecutor = 'MultiSpeQ device';",
        },
        { path: "apps/mobile/product.fixture.ts", content: "MultiSpeQ" },
      ],
      rule({ id: "content", category: "family-aware" }),
      rule({
        id: "symbol",
        category: "rename-neutral",
        granularity: "symbol-key",
        pattern: "^MultispeqCommandExecutor$",
        disposition: "rename",
        target: "DeviceCommandExecutor",
      }),
      rule({
        id: "file",
        category: "fixture",
        granularity: "file",
        paths: ["apps/mobile/product.fixture.ts"],
        pattern: undefined,
        disposition: "fixture-only",
        target: "product fixture",
      }),
    );

    expect(report.findings.map((finding) => finding.ruleIds[0])).toEqual([
      "symbol",
      "content",
      "file",
    ]);
  });

  it("reports equal-specificity matches as ambiguous", () => {
    const report = scan(
      [{ path: "apps/mobile/example.ts", content: "MultispeqThing" }],
      rule({ id: "left", granularity: "symbol-key", pattern: "MultispeqThing" }),
      rule({ id: "right", granularity: "symbol-key", pattern: "MultispeqThing" }),
    );

    expect(report.findings[0]).toMatchObject({ status: "ambiguous", ruleIds: ["left", "right"] });
  });

  it("enforces exact identifier denylist entries", () => {
    const deny = rule({
      id: "deny",
      kind: "denylist",
      category: "rename-neutral",
      granularity: "symbol-key",
      pattern: "genericMultispeqDevice",
      disposition: "rename",
      target: "genericDevice",
    });
    const report = scan(
      [
        {
          path: "apps/mobile/example.ts",
          content: "genericMultispeqDevice genericMultispeqDeviceExtra",
        },
      ],
      deny,
      rule({ id: "classification" }),
    );

    expect(report.findings.map((finding) => finding.status)).toEqual(["forbidden", "classified"]);
  });

  it("enforces exact identifier denylists through member access without matching longer names", () => {
    const deny = rule({
      id: "deny",
      kind: "denylist",
      category: "rename-neutral",
      granularity: "symbol-key",
      pattern: "genericMultispeqDevice",
      disposition: "rename",
      target: "genericDevice",
    });
    const report = scan(
      [
        {
          path: "apps/mobile/product.ts",
          content:
            "this.genericMultispeqDevice this.GenericMultispeqDevice this.genericMultispeqDeviceExtra",
        },
      ],
      deny,
      rule({ id: "product-preserve" }),
    );

    expect(report.findings.map(({ status, token }) => ({ status, token }))).toEqual([
      { status: "forbidden", token: "this.genericMultispeqDevice" },
      { status: "forbidden", token: "this.GenericMultispeqDevice" },
      { status: "classified", token: "this.genericMultispeqDeviceExtra" },
    ]);
  });

  it("preserves exact dotted translation-key denylists through an outer qualifier", () => {
    const deny = rule({
      id: "deny-key",
      kind: "denylist",
      category: "rename-neutral",
      granularity: "symbol-key",
      pattern: "device.genericMultispeq",
      disposition: "rename",
      target: "device.generic",
    });
    const report = scan(
      [
        {
          path: "apps/mobile/translations.ts",
          content: "t.device.genericMultispeq t.device.genericMultispeqExtra",
        },
      ],
      deny,
      rule({ id: "product-preserve" }),
    );

    expect(report.findings.map(({ status, token }) => ({ status, token }))).toEqual([
      { status: "forbidden", token: "t.device.genericMultispeq" },
      { status: "classified", token: "t.device.genericMultispeqExtra" },
    ]);
  });

  it("enforces exact retired file and directory paths", () => {
    const deny = rule({
      id: "deny-path",
      kind: "denylist",
      category: "rename-neutral",
      granularity: "path",
      paths: ["apps/mobile/**"],
      pattern: "apps/mobile/src/connection/multispeq",
      disposition: "rename",
      target: "apps/mobile/src/connection/device",
    });
    const report = scan(
      [
        {
          path: "apps/mobile/src/connection/multispeq/index.ts",
          content: "ordinary content",
        },
      ],
      deny,
    );

    expect(report.findings[0]).toMatchObject({ status: "forbidden", ruleIds: ["deny-path"] });
  });

  it("flags dead active rename rules but exempts preservation rules", () => {
    const report = scan(
      [{ path: "apps/mobile/example.ts", content: "ordinary device" }],
      rule({
        id: "rename",
        category: "rename-neutral",
        disposition: "rename",
        target: "device",
      }),
      rule({ id: "preserve" }),
    );

    expect(report.deadRules).toEqual([
      { ruleId: "rename", reason: "active rename rule no longer classifies a reference" },
    ]);
  });

  it("keeps a denylist live by tracked scope and reports a nonexistent scope as dead", () => {
    const existingScope = rule({
      id: "existing-scope",
      kind: "denylist",
      category: "rename-neutral",
      granularity: "symbol-key",
      paths: ["apps/mobile/**"],
      pattern: "genericMultispeqDevice",
      disposition: "rename",
      target: "genericDevice",
    });
    const missingScope = rule({
      ...existingScope,
      id: "missing-scope",
      paths: ["apps/nonexistent/**"],
    });
    const report = scan(
      [{ path: "apps/mobile/example.ts", content: "ordinary device" }],
      existingScope,
      missingScope,
    );

    expect(report.deadRules).toEqual([
      {
        ruleId: "missing-scope",
        reason: "denylist scope no longer matches a tracked path",
      },
    ]);
    expect(exitCodeForMode(report, "strict")).toBe(1);
  });

  it("keeps findings non-blocking only in report mode", () => {
    const report = scan([{ path: "apps/web/new.ts", content: "NewMultispeqController" }]);

    expect(report.findings[0]?.status).toBe("unclassified");
    expect(exitCodeForMode(report, "report")).toBe(0);
    expect(exitCodeForMode(report, "strict")).toBe(1);
  });

  it("makes strict mode catch a retired identifier and a new editable reference together", () => {
    const report = scan(
      [
        {
          path: "apps/mobile/new-device.ts",
          content: "genericMultispeqDevice NewMultispeqAbstraction",
        },
      ],
      rule({
        id: "retired",
        kind: "denylist",
        category: "rename-neutral",
        granularity: "symbol-key",
        pattern: "genericMultispeqDevice",
        disposition: "rename",
        target: "genericDevice",
      }),
    );

    expect(report.findings.map((finding) => finding.status)).toEqual(["forbidden", "unclassified"]);
    expect(exitCodeForMode(report, "strict")).toBe(1);
  });

  it("serializes deterministic repository-relative JSON", () => {
    const files = [
      { path: "apps/mobile/z.ts", content: "MultiSpeQ" },
      { path: "apps/mobile/a.ts", content: "multispeq" },
    ];
    const first = serializeReport(scan(files, rule()));
    const second = serializeReport(scan([...files].reverse(), rule()));

    expect(first).toBe(second);
    expect(first).not.toContain(process.cwd());
  });
});

describe("real manifest drift protection", () => {
  const repositoryRoot = resolve(import.meta.dirname, "../../..");

  it("rejects qualified retired identifiers inside a product-preserve scope", () => {
    const report = scanTrackedFiles(
      [
        {
          path: "apps/mobile/src/features/connection/services/multispeq/member-access.ts",
          content: "this.genericMultispeqDevice this.genericMultispeqDeviceExtra",
        },
      ],
      realManifest,
    );

    expect(report.findings.map(({ status, token }) => ({ status, token }))).toEqual([
      { status: "classified", token: "multispeq" },
      { status: "forbidden", token: "this.genericMultispeqDevice" },
      { status: "classified", token: "this.genericMultispeqDeviceExtra" },
    ]);
  });

  it("leaves brand-new generic web, mobile, docs, and API content unclassified", () => {
    const files = [
      {
        path: "apps/web/components/new-generic-copy.tsx",
        content: 'const copy = "Connect your MultiSpeQ device";',
      },
      {
        path: "apps/mobile/src/features/connection/new.ts",
        content: "export class NewMultispeqController {}",
      },
      {
        path: "apps/docs/content/guide/new-page.mdx",
        content: "Use a MultiSpeQ for this generic workflow.",
      },
      {
        path: "packages/api/src/domains/device/new-thing.ts",
        content: "// a brand new multispeq mention",
      },
    ];
    const report = scanTrackedFiles(files, realManifest);

    expect(report.findings).toHaveLength(4);
    expect(report.findings.every((finding) => finding.status === "unclassified")).toBe(true);
    expect(report.findings.map((finding) => finding.path).toSorted()).toEqual(
      files.map((file) => file.path).toSorted(),
    );
  });

  it("leaves a new product-named path outside explicit zones unclassified", () => {
    const report = scanTrackedFiles(
      [
        {
          path: "apps/web/lib/brand-new-multispeq-helper.ts",
          content: "export const helper = true;",
        },
      ],
      realManifest,
    );

    expect(report.findings).toEqual([
      expect.objectContaining({
        path: "apps/web/lib/brand-new-multispeq-helper.ts",
        kind: "path",
        status: "unclassified",
      }),
    ]);
  });

  it("classifies only the four verified IoT product specs as fixtures and fails a generic spec closed", () => {
    const verifiedSpecs = [
      "packages/iot/src/core/identify-device.spec.ts",
      "packages/iot/src/core/types.spec.ts",
      "packages/iot/src/driver/multispeq/driver.spec.ts",
      "packages/iot/src/driver/multispeq/multispeq-protocol-estimator.spec.ts",
    ];
    const genericSpec = "packages/iot/src/transport/new-generic.spec.ts";
    const report = scanTrackedFiles(
      [
        ...verifiedSpecs.map((path) => ({ path, content: "MultiSpeQ" })),
        { path: genericSpec, content: "MultiSpeQ" },
      ],
      realManifest,
    );

    for (const path of verifiedSpecs) {
      const finding = report.findings.find((entry) => entry.path === path);
      expect(finding).toMatchObject({ status: "classified", category: "fixture" });
      expect(finding?.ruleIds).toContain("iot.product-fixtures");
    }

    expect(report.findings.find((entry) => entry.path === genericSpec)).toMatchObject({
      status: "unclassified",
    });
    expect(exitCodeForMode(report, "strict")).toBe(1);
  });

  it("attributes denylist findings and counts to the offending source surface", () => {
    const files = [
      { path: "apps/mobile/src/new.ts", content: "genericMultispeqDevice" },
      { path: "apps/web/lib/new.ts", content: "genericMultispeqDevice" },
      { path: "packages/api/src/new.ts", content: "genericMultispeqDevice" },
    ];
    const report = scanTrackedFiles(files, realManifest);

    expect(report.findings.map(({ path, status, surface }) => ({ path, status, surface }))).toEqual(
      [
        { path: "apps/mobile/src/new.ts", status: "forbidden", surface: "mobile" },
        { path: "apps/web/lib/new.ts", status: "forbidden", surface: "web" },
        { path: "packages/api/src/new.ts", status: "forbidden", surface: "api" },
      ],
    );
    expect(report.countsBySurface).toMatchObject({ api: 1, mobile: 1, tooling: 0, web: 1 });
  });

  it("preserves the declared mobile family fallback and its routing use", async () => {
    const declarationPath =
      "apps/mobile/src/features/connection/services/mobile-runtime-support.ts";
    const routePath =
      "apps/mobile/src/features/measurement-flow/screens/measurement-flow-screen/components/flow-nodes/utils/evaluate-and-route.ts";
    const declaration = await readFile(resolve(repositoryRoot, declarationPath), "utf8");
    const route = await readFile(resolve(repositoryRoot, routePath), "utf8");
    const report = scanTrackedFiles(
      [
        { path: declarationPath, content: declaration },
        { path: routePath, content: route },
      ],
      realManifest,
    );
    const familyValue = report.findings.find(
      (finding) => finding.path === declarationPath && finding.token === "multispeq",
    );

    expect(familyValue).toMatchObject({
      status: "classified",
      ruleIds: ["mobile.family-values"],
      surface: "mobile",
      category: "keep-compatibility",
    });
    expect(declaration).toMatch(/MOBILE_PRE_IDENTITY_FAMILY\s*=\s*["']multispeq["']\s+as const/u);
    expect(route).toMatch(
      /import\s*\{\s*MOBILE_PRE_IDENTITY_FAMILY\s*\}[^;]+mobile-runtime-support["'];/u,
    );
    expect(route).toMatch(/family:\s*MOBILE_PRE_IDENTITY_FAMILY/u);
  });

  it("rejects retired mobile executor paths and contract symbols", () => {
    const report = scanTrackedFiles(
      [
        {
          path: "apps/mobile/src/features/connection/services/multispeq-communication/driver-command-executor.ts",
          content: "export interface DeviceCommandExecutor {}",
        },
        {
          path: "apps/mobile/src/features/connection/services/device-command-executor.ts",
          content: "export interface IMultispeqCommandExecutor {}",
        },
      ],
      realManifest,
    );

    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "apps/mobile/src/features/connection/services/multispeq-communication/driver-command-executor.ts",
          kind: "path",
          status: "forbidden",
          ruleIds: ["mobile.deny-retired-multispeq-communication-path"],
        }),
        expect.objectContaining({
          path: "apps/mobile/src/features/connection/services/device-command-executor.ts",
          token: "IMultispeqCommandExecutor",
          status: "forbidden",
          ruleIds: ["mobile.deny-retired-multispeq-executor-contract"],
        }),
      ]),
    );
  });

  it("keeps the neutral contract free of product references and classifies the concrete boundary", async () => {
    const neutralPath = "apps/mobile/src/features/connection/services/device-command-executor.ts";
    const productPath =
      "apps/mobile/src/features/connection/services/multispeq/multispeq-command-executor.ts";
    const files = [
      { path: neutralPath, content: await readFile(resolve(repositoryRoot, neutralPath), "utf8") },
      { path: productPath, content: await readFile(resolve(repositoryRoot, productPath), "utf8") },
    ];
    const report = scanTrackedFiles(files, realManifest);

    expect(files[0].content).toMatch(/export interface DeviceCommandExecutor/u);
    expect(report.findings.filter((finding) => finding.path === neutralPath)).toEqual([]);
    const productFindings = report.findings.filter((finding) => finding.path === productPath);
    expect(productFindings.length).toBeGreaterThan(0);
    expect(
      productFindings.every(
        (finding) =>
          finding.status === "classified" &&
          (finding.category === "keep-product-specific" ||
            finding.category === "keep-compatibility"),
      ),
    ).toBe(true);
    expect(
      productFindings.some(
        (finding) =>
          finding.kind === "path" &&
          finding.category === "keep-product-specific" &&
          finding.ruleIds.includes("mobile.multispeq-product-path"),
      ),
    ).toBe(true);
  });
});

describe("tracked-file input", () => {
  it("reads only tracked files and excludes tracked build output", async () => {
    const root = await mkdtemp(join(tmpdir(), "nomenclature-git-"));
    try {
      execFileSync("git", ["init", "-q"], { cwd: root });
      await mkdir(join(root, "src"));
      await mkdir(join(root, "dist"));
      await writeFile(join(root, "src", "tracked.ts"), "MultiSpeQ");
      await writeFile(join(root, "src", "untracked.ts"), "MultiSpeQ");
      await writeFile(join(root, "dist", "generated.js"), "MultiSpeQ");
      execFileSync("git", ["add", "src/tracked.ts", "dist/generated.js"], { cwd: root });

      expect((await readTrackedFiles(root)).map((file) => file.path)).toEqual(["src/tracked.ts"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not downgrade git operational errors to report findings", async () => {
    const root = await mkdtemp(join(tmpdir(), "nomenclature-no-git-"));
    try {
      await expect(readTrackedFiles(root)).rejects.toThrow("Unable to enumerate tracked files");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("surface manifest aggregation", () => {
  it("sorts shards and rules deterministically", () => {
    const aggregated = aggregateManifest({ z: [rule({ id: "z" })], a: [rule({ id: "a" })] });
    expect(aggregated.rules.map((entry) => entry.id)).toEqual(["a", "z"]);
  });

  it("rejects duplicate rule ids", () => {
    expect(() => aggregateManifest({ a: [rule()], b: [rule()] })).toThrow(
      "Duplicate nomenclature rule id",
    );
  });
});
