import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { checkDependencyBoundaries } from "./check-dependency-boundaries.mjs";

function workspace(t, changes = {}) {
  const root = mkdtempSync(join(tmpdir(), "cms-dependencies-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "fixture", private: true, packageManager: "pnpm@11.15.0" }),
  );
  writeFileSync(join(root, "pnpm-workspace.yaml"), 'packages:\n  - "packages/*"\n');
  writeFileSync(join(root, "turbo.json"), JSON.stringify({ tasks: {} }));
  writeFileSync(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\nimporters: {}\n");
  const packages = {
    backend: { dependencies: { "@repo/transactional": "workspace:*" } },
    mobile: { dependencies: { "@repo/cms": "workspace:*" } },
    "@repo/transactional": { dependencies: { "@repo/cms": "workspace:*" } },
    "@repo/cms": {},
    "@repo/ui": {},
    web: { dependencies: { "@repo/ui": "workspace:*", "@repo/cms": "workspace:*" } },
    ...changes,
  };
  for (const [name, manifest] of Object.entries(packages)) {
    const directory = join(root, "packages", name.replace("@repo/", ""));
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "package.json"), JSON.stringify({ name, ...manifest }));
  }
  return root;
}

test("allows CMS data consumers alongside web presentation", (t) => {
  assert.deepEqual(checkDependencyBoundaries(workspace(t)), []);
});

test("rejects the original transitive UI dependency through transactional email", (t) => {
  const root = workspace(t, {
    "@repo/cms": { dependencies: { "@repo/ui": "workspace:*" } },
  });
  assert.deepEqual(checkDependencyBoundaries(root), [
    "backend must stay independent of @repo/ui: backend -> @repo/transactional -> @repo/cms -> @repo/ui",
    "mobile must stay independent of @repo/ui: mobile -> @repo/cms -> @repo/ui",
    "@repo/cms must stay independent of @repo/ui: @repo/cms -> @repo/ui",
  ]);
});

test("rejects UI leaking into CMS through another package", (t) => {
  const root = workspace(t, {
    "@repo/cms": { dependencies: { "@repo/shared": "workspace:*" } },
    "@repo/shared": { dependencies: { "@repo/ui": "workspace:*" } },
  });
  assert.deepEqual(checkDependencyBoundaries(root), [
    "backend must stay independent of @repo/ui: backend -> @repo/transactional -> @repo/cms -> @repo/shared -> @repo/ui",
    "mobile must stay independent of @repo/ui: mobile -> @repo/cms -> @repo/shared -> @repo/ui",
    "@repo/cms must stay independent of @repo/ui: @repo/cms -> @repo/shared -> @repo/ui",
  ]);
});

for (const field of ["devDependencies", "optionalDependencies", "peerDependencies"]) {
  test(`checks ${field} too`, (t) => {
    const root = workspace(t, { mobile: { [field]: { "@repo/ui": "workspace:*" } } });
    assert.deepEqual(checkDependencyBoundaries(root), [
      "mobile must stay independent of @repo/ui: mobile -> @repo/ui",
    ]);
  });
}

test("fails closed if a protected package is missing", (t) => {
  const root = workspace(t);
  rmSync(join(root, "packages/mobile"), { recursive: true });
  assert.throws(() => checkDependencyBoundaries(root));
});

test("rejects CMS leaking into shared UI through another package", (t) => {
  const root = workspace(t, {
    "@repo/ui": { dependencies: { "@repo/shared": "workspace:*" } },
    "@repo/shared": { dependencies: { "@repo/cms": "workspace:*" } },
  });
  assert.deepEqual(checkDependencyBoundaries(root), [
    "@repo/ui must stay independent of @repo/cms: @repo/ui -> @repo/shared -> @repo/cms",
  ]);
});

for (const field of [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
]) {
  test(`rejects CMS in shared UI ${field}`, (t) => {
    const root = workspace(t, { "@repo/ui": { [field]: { "@repo/cms": "workspace:*" } } });
    assert.deepEqual(checkDependencyBoundaries(root), [
      "@repo/ui must stay independent of @repo/cms: @repo/ui -> @repo/cms",
    ]);
  });
}
