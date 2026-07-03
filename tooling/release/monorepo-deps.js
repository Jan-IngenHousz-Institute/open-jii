/**
 * Dependency-aware replacement for `semantic-release-monorepo`'s commit filter.
 *
 * `semantic-release-monorepo` scopes each app's release to commits that touched
 * the app's OWN directory. In this monorepo the apps (`mobile`, `web`,
 * `backend`) ship shared `@repo/*` packages, so a fix landed in a shared package
 * (e.g. `fix(iot)` under `packages/iot`) never cut a release for the apps that
 * bundle it: the app's next release silently swallowed the fix with no version.
 *
 * This module keeps the per-app monorepo scoping (tag format, notes, success)
 * but widens the "relevant commit" path set to the app PLUS its transitive
 * workspace runtime `dependencies`. Only runtime `dependencies` propagate a
 * release: config/tooling packages consumed as `devDependencies` (eslint-config,
 * typescript-config, vitest-config, tailwind-config) deliberately do NOT bump an
 * app version. The turbo affected graph (used by the release workflow to pick
 * which apps to run) also follows devDependencies, so it may enter an app into
 * the release loop where this filter then correctly finds no relevant commit.
 *
 * Wired into each app via `apps/<app>/.releaserc.js` (replaces
 * `extends: "semantic-release-monorepo"`). Reuses the upstream plugin's file
 * listing and version->tag transforms so changelog/tag behaviour is unchanged.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { withFiles } from "semantic-release-monorepo/src/only-package-commits.js";
import {
  mapCommits,
  mapNextReleaseVersion,
  withOptionsTransforms,
} from "semantic-release-monorepo/src/options-transforms.js";
import versionToGitTag from "semantic-release-monorepo/src/version-to-git-tag.js";
import { wrapStep } from "semantic-release-plugin-decorators";

const WORKSPACE_GROUPS = ["apps", "packages", "tooling"];

const gitRoot = () =>
  execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

/** Map every workspace package name -> its absolute directory. */
const indexWorkspace = (root) => {
  const byName = new Map();
  for (const group of WORKSPACE_GROUPS) {
    const base = path.join(root, group);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base)) {
      const manifest = path.join(base, entry, "package.json");
      if (!existsSync(manifest)) continue;
      try {
        const { name } = readJson(manifest);
        if (name) byName.set(name, path.join(base, entry));
      } catch {
        // ignore unreadable / malformed manifests
      }
    }
  }
  return byName;
};

/**
 * Directories (relative to the git root) whose commits count towards the
 * current package's release: the package itself plus its transitive workspace
 * runtime dependencies. External (published) deps are ignored.
 */
export const computeRelevantPaths = () => {
  const root = gitRoot();
  const byName = indexWorkspace(root);
  const start = readJson(path.join(process.cwd(), "package.json")).name;

  const dirs = new Set([process.cwd()]);
  const seen = new Set();
  const queue = [start];
  while (queue.length > 0) {
    const name = queue.shift();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const dir = byName.get(name);
    if (!dir) continue; // external dependency, not a workspace package
    dirs.add(dir);
    let deps = {};
    try {
      deps = readJson(path.join(dir, "package.json")).dependencies ?? {};
    } catch {
      continue;
    }
    for (const dep of Object.keys(deps)) {
      if (byName.has(dep)) queue.push(dep);
    }
  }
  return [...dirs].map((dir) => path.relative(root, dir)).filter(Boolean);
};

// Keyed by cwd so a hypothetical multi-app process never reuses stale paths.
const segmentCache = new Map();
const relevantSegments = () => {
  const key = process.cwd();
  if (!segmentCache.has(key)) {
    segmentCache.set(
      key,
      computeRelevantPaths().map((relPath) => relPath.split(path.sep)),
    );
  }
  return segmentCache.get(key);
};

const isRelevantFile = (file) => {
  const fileSegments = path.normalize(file).split(path.sep);
  return relevantSegments().some((segments) =>
    segments.every((segment, i) => segment === fileSegments[i]),
  );
};

/** Filter a commit list to those touching the package or its workspace deps. */
export const onlyRelevantCommits = async (commits) => {
  const commitsWithFiles = await withFiles(commits);
  return commitsWithFiles.filter(({ files }) => files.some(isRelevantFile));
};

const withOnlyRelevantCommits = (plugin) => async (pluginConfig, config) =>
  plugin(pluginConfig, await mapCommits(onlyRelevantCommits)(config));

const withReleaseTag = withOptionsTransforms([mapNextReleaseVersion(versionToGitTag)]);

const wrapperName = "monorepo-deps";

export const analyzeCommits = wrapStep("analyzeCommits", withOnlyRelevantCommits, {
  wrapperName,
});
export const generateNotes = wrapStep(
  "generateNotes",
  (plugin) => withOnlyRelevantCommits(withReleaseTag(plugin)),
  { wrapperName },
);
export const success = wrapStep(
  "success",
  (plugin) => withOnlyRelevantCommits(withReleaseTag(plugin)),
  { wrapperName },
);
export const fail = wrapStep("fail", (plugin) => withOnlyRelevantCommits(withReleaseTag(plugin)), {
  wrapperName,
});
