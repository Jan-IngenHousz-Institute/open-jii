import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const turbo = fileURLToPath(new URL("../node_modules/turbo/bin/turbo", import.meta.url));
const dependencyRules = [
  ["backend", "@repo/ui"],
  ["mobile", "@repo/ui"],
  ["@repo/cms", "@repo/ui"],
  ["@repo/ui", "@repo/cms"],
];
const dependencyFields = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

export function checkDependencyBoundaries(root = repositoryRoot) {
  const result = JSON.parse(
    execFileSync(process.execPath, [turbo, "ls", "--output=json"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
  const dependencies = new Map(
    result.packages.items.map(({ name, path }) => {
      const manifest = JSON.parse(readFileSync(join(root, path, "package.json"), "utf8"));
      return [name, dependencyFields.flatMap((field) => Object.keys(manifest[field] ?? {}))];
    }),
  );
  const violations = [];
  for (const [name, forbidden] of dependencyRules) {
    if (!dependencies.has(name)) {
      throw new Error(`Dependency check did not find protected package ${name}`);
    }
    const queue = [[name]];
    const seen = new Set();
    for (const chain of queue) {
      const current = chain.at(-1);
      if (seen.has(current)) continue;
      seen.add(current);
      if (current === forbidden) {
        violations.push(`${name} must stay independent of ${forbidden}: ${chain.join(" -> ")}`);
        continue;
      }
      for (const dependency of dependencies.get(current) ?? []) {
        if (dependencies.has(dependency)) queue.push([...chain, dependency]);
      }
    }
  }
  return violations;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const violations = checkDependencyBoundaries();
  if (violations.length > 0) {
    console.error(violations.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Backend and mobile are independent of UI; CMS and shared UI are independent");
  }
}
