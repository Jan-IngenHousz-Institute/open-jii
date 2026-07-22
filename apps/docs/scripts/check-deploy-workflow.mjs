import { load } from "js-yaml";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appRoot, "../..");
const deployWorkflowPath = path.join(repoRoot, ".github/workflows/deploy-docs.yml");
const prWorkflowPath = path.join(repoRoot, ".github/workflows/pr.yml");

function workflowSteps(workflow, job) {
  const steps = workflow.jobs?.[job]?.steps;
  assert.ok(Array.isArray(steps), `workflow job ${job} has no steps`);
  return steps;
}

function stepByName(steps, name) {
  const step = steps.find((candidate) => candidate.name === name);
  assert.ok(step, `workflow step not found: ${name}`);
  return step;
}

function renderRunScript(script) {
  assert.equal(typeof script, "string");
  return script
    .replaceAll("${{ env.DOCS_BUCKET }}", "fixture-bucket")
    .replaceAll("${{ inputs.environment }}", "dev")
    .replaceAll("${{ steps.get-sha.outputs.sha }}", "fixture-sha");
}

function runBash(script, { cwd, env }) {
  return spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", script], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function outputMap(contents) {
  return new Map(
    contents
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

async function writeFakeAws(binDirectory) {
  const fakeAws = path.join(binDirectory, "aws");
  await writeFile(
    fakeAws,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'printf \'%s\\n\' "$*" >> "$FAKE_AWS_LOG"',
      'if [[ "$1" == "s3" && "$2" == "sync" && "$3" == s3://* ]]; then',
      '  case "$FAKE_AWS_MODE" in',
      "    capture-error) exit 42 ;;",
      "    capture-empty) exit 0 ;;",
      "    capture-populated)",
      '      mkdir -p "$4"',
      "      printf 'previous site\\n' > \"$4/index.html\"",
      "      exit 0",
      "      ;;",
      "  esac",
      "fi",
      "exit 0",
      "",
    ].join("\n"),
  );
  await chmod(fakeAws, 0o755);
}

async function probeArchiveScript(archiveScript) {
  for (const mode of ["capture-error", "capture-empty", "capture-populated"]) {
    const root = await mkdtemp(path.join(os.tmpdir(), `openjii-docs-${mode}-`));
    try {
      const binDirectory = path.join(root, "bin");
      const awsLog = path.join(root, "aws.log");
      const githubOutput = path.join(root, "github-output");
      const uploadProbe = path.join(root, "upload-probe");
      await mkdir(binDirectory);
      await writeFile(awsLog, "");
      await writeFile(githubOutput, "");
      await writeFakeAws(binDirectory);

      const result = runBash(`${archiveScript}\nprintf 'upload-reached\\n' >> "$UPLOAD_PROBE"`, {
        cwd: root,
        env: {
          FAKE_AWS_LOG: awsLog,
          FAKE_AWS_MODE: mode,
          GITHUB_OUTPUT: githubOutput,
          PATH: `${binDirectory}:${process.env.PATH}`,
          UPLOAD_PROBE: uploadProbe,
        },
      });
      const outputs = outputMap(await readFile(githubOutput, "utf8"));
      assert.equal(outputs.get("artifact_name"), "docs-rollback-dev-fixture-sha");

      if (mode === "capture-error") {
        assert.notEqual(result.status, 0, "rollback mirror error must fail the step");
        await assert.rejects(readFile(uploadProbe), { code: "ENOENT" });
      } else {
        assert.equal(result.status, 0, result.stderr);
        assert.equal((await readFile(uploadProbe, "utf8")).trim(), "upload-reached");
        assert.equal(outputs.get("archived"), mode === "capture-empty" ? "false" : "true");
        if (mode === "capture-populated") {
          assert.equal(outputs.get("archive"), "docs-rollback-dev-fixture-sha.tar.gz");
        } else {
          assert.equal(outputs.has("archive"), false);
        }
      }
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  }
}

async function probeUploadScript(uploadScript) {
  const root = await mkdtemp(path.join(os.tmpdir(), "openjii-docs-upload-"));
  try {
    const binDirectory = path.join(root, "bin");
    const buildDirectory = path.join(root, "apps/docs/out");
    const awsLog = path.join(root, "aws.log");
    const githubOutput = path.join(root, "github-output");
    await mkdir(binDirectory);
    await mkdir(buildDirectory, { recursive: true });
    await Promise.all([
      writeFile(path.join(buildDirectory, "index.html"), "<html></html>"),
      writeFile(path.join(buildDirectory, "asset.js"), "export {};"),
      writeFile(path.join(buildDirectory, "sitemap.xml"), "<urlset />"),
      writeFile(path.join(buildDirectory, "robots.txt"), "User-agent: *"),
      writeFile(awsLog, ""),
      writeFile(githubOutput, ""),
    ]);
    await writeFakeAws(binDirectory);

    const result = runBash(uploadScript, {
      cwd: root,
      env: {
        FAKE_AWS_LOG: awsLog,
        FAKE_AWS_MODE: "upload",
        GITHUB_OUTPUT: githubOutput,
        PATH: `${binDirectory}:${process.env.PATH}`,
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(outputMap(await readFile(githubOutput, "utf8")).get("uploaded"), "true");

    const commands = (await readFile(awsLog, "utf8")).trim().split("\n");
    assert.equal(commands.filter((line) => line.startsWith("s3 rm ")).length, 1);
    assert.equal(commands.filter((line) => line.startsWith("s3 sync ")).length, 3);
    assert.equal(
      commands.some((line) => line.startsWith("s3 cp ")),
      false,
    );

    const deleteClasses = commands.find((line) => line.startsWith("s3 rm "));
    assert.match(deleteClasses, /--recursive/);
    for (const pattern of ["*.html", "*.xml", "*.txt"]) {
      assert.ok(deleteClasses.includes(`--include ${pattern}`));
    }

    const syncs = commands.filter((line) => line.startsWith("s3 sync "));
    const staticAssets = syncs.find((line) => line.includes("max-age=31536000"));
    const html = syncs.find((line) => line.includes("max-age=0, must-revalidate"));
    const text = syncs.find((line) => line.includes("max-age=86400"));
    assert.ok(staticAssets?.includes("--delete"));
    for (const pattern of ["*.html", "*.xml", "*.txt"]) {
      assert.ok(staticAssets.includes(`--exclude ${pattern}`));
    }
    assert.ok(html?.includes("--exclude * --include *.html"));
    assert.equal(html.includes("*.xml"), false);
    assert.equal(html.includes("*.txt"), false);
    assert.ok(text?.includes("--exclude * --include *.xml --include *.txt"));
    assert.equal(text.includes("*.html"), false);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

const deployWorkflow = load(await readFile(deployWorkflowPath, "utf8"));
const deploySteps = workflowSteps(deployWorkflow, "deploy-docs");
const archiveStep = stepByName(deploySteps, "Archive Current Site (Rollback Artifact)");
const artifactStep = stepByName(deploySteps, "Upload Rollback Artifact");
const uploadStep = stepByName(deploySteps, "Upload Documentation to S3");
const summaryStep = stepByName(deploySteps, "Deployment Summary");
assert.ok(deploySteps.indexOf(archiveStep) < deploySteps.indexOf(uploadStep));
assert.equal(artifactStep.with?.["if-no-files-found"], "error");
assert.match(summaryStep.run, /steps\.rollback-archive\.outputs\.artifact_name/);

await probeArchiveScript(renderRunScript(archiveStep.run));
await probeUploadScript(renderRunScript(uploadStep.run));

const prWorkflow = load(await readFile(prWorkflowPath, "utf8"));
const driftStep = stepByName(
  workflowSteps(prWorkflow, "docs_spec_drift"),
  "Detect docs-relevant spec changes",
);
for (const requiredPath of [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "packages/api/",
  "apps/docs/package.json",
]) {
  assert.ok(driftStep.run.includes(requiredPath), `spec drift guard omits ${requiredPath}`);
}

const runbook = await readFile(path.join(appRoot, "ROLLBACK.md"), "utf8");
for (const requiredCommand of [
  "gh run download",
  "aws s3 sync",
  "--delete",
  "diff -qr",
  "aws cloudfront wait invalidation-completed",
  "validate:deployment",
]) {
  assert.ok(runbook.includes(requiredCommand), `rollback runbook omits ${requiredCommand}`);
}
const shellBlocks = [...runbook.matchAll(/```sh\n([\s\S]*?)```/g)].map((match) => match[1]);
assert.ok(shellBlocks.length > 0, "rollback runbook contains no shell blocks");
for (const [index, shellBlock] of shellBlocks.entries()) {
  const syntax = spawnSync("bash", ["-n", "-c", shellBlock], { encoding: "utf8" });
  assert.equal(syntax.status, 0, `rollback shell block ${index + 1}: ${syntax.stderr}`);
}

console.log(
  "Deployment workflow checks passed: rollback mirror failure blocks upload; empty and populated mirrors are handled; cache/delete classes, artifact summary, drift inputs, and rollback runbook are valid.",
);
