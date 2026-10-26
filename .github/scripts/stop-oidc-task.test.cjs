const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

for (const [job, task, state, calls] of [
  ["success", "task-arn", "RUNNING", []],
  ["failure", "", "RUNNING", []],
  ["failure", "task-arn", "RUNNING", ["describe-tasks", "stop-task"]],
  ["cancelled", "task-arn", "RUNNING", ["describe-tasks", "stop-task"]],
  ["cancelled", "task-arn", "STOPPED", ["describe-tasks"]],
  ["failure", "task-arn", "None", ["describe-tasks"]],
]) {
  test(`cleanup ${job}, ${task || "no task"}, ${state}`, () => {
    const dir = mkdtempSync(join(tmpdir(), "oidc-cleanup-"));
    try {
      const log = join(dir, "calls");
      writeFileSync(
        join(dir, "aws"),
        '#!/usr/bin/env bash\necho "$2" >> "$CALL_LOG"\nif [[ "$2" == describe-tasks ]]; then echo "$TASK_STATE"; fi\n',
        { mode: 0o700 },
      );
      const result = spawnSync("bash", [join(__dirname, "stop-oidc-task.sh")], {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${dir}:${process.env.PATH}`,
          JOB_STATUS: job,
          TASK_ARN: task,
          CLUSTER_NAME: "test-cluster",
          CALL_LOG: log,
          TASK_STATE: state,
        },
      });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : [], calls);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
}
