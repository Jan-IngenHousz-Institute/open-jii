import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../../..", import.meta.url));
const guard = join(root, ".claude/hooks/analyst-guard.sh");

/**
 * The hook reads its production marker and writes its audit log relative to the project directory,
 * so the tests point that at a temporary copy. Running the suite against the real checkout would
 * fail whenever a developer happened to have a production window open, and would then delete it.
 */
let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "openjii-guard-"));
  mkdirSync(join(projectDir, ".claude"), { recursive: true });
});

function check(command: string): { blocked: boolean; message: string } {
  const result = spawnSync("bash", [guard], {
    input: JSON.stringify({ session_id: "test", tool_input: { command } }),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
  });
  return { blocked: result.status === 2, message: result.stderr };
}

function openProdWindow(ageSeconds = 0): void {
  const marker = join(projectDir, ".claude/analyst-prod.ok");
  writeFileSync(marker, "open\n", "utf8");
  if (ageSeconds > 0) {
    const when = new Date(Date.now() - ageSeconds * 1000);
    utimesSync(marker, when, when);
  }
}

describe("what the guard allows", () => {
  it.each([
    "aws ecs describe-services --cluster backend-cluster-dev --services backend-dev",
    "aws ecs list-tasks --cluster backend-cluster-dev",
    "aws logs filter-log-events --log-group-name /aws/ecs/backend-service-dev --start-time 1 --limit 50",
    "aws logs start-query --log-group-name /aws/ecs/backend-service-dev --since 1h",
    "aws cloudwatch get-metric-statistics --namespace AWS/ECS",
    "aws lambda get-function-configuration --function-name open-jii-dev-server",
    "aws sts get-caller-identity",
    "aws s3api list-buckets",
    "aws ssm get-parameter --name /opennext/dev/server-function",
    "aws secretsmanager describe-secret --secret-id openjii-auth-secrets-dev",
    "databricks current-user me",
    "databricks jobs list",
    "databricks tables get open_jii_dev.centrum.raw_data",
    "databricks statement-execution execute-statement --warehouse-id w --statement 'SELECT 1'",
    "databricks fs ls dbfs:/",
    "tofu fmt --recursive",
    "tofu validate",
    "kubectl get pods",
    "kubectl logs pod-name",
    "git status",
    "pnpm test",
  ])("allows %s", (command) => {
    expect(check(command).blocked).toBe(false);
  });
});

describe("what the guard blocks", () => {
  it.each([
    ["an s3 delete", "aws s3 rm s3://open-jii-dev-assets/thing"],
    ["a secret value", "aws secretsmanager get-secret-value --secret-id openjii-auth-secrets-dev"],
    ["an object read", "aws s3api get-object --bucket b --key k /tmp/out"],
    ["a dynamodb read", "aws dynamodb get-item --table-name t --key {}"],
    ["a kinesis record read", "aws kinesis get-shard-iterator --stream-name s"],
    ["a lambda invoke", "aws lambda invoke --function-name f /tmp/out"],
    ["an ecs exec", "aws ecs execute-command --cluster c --task t --command sh"],
    ["an assume-role", "aws sts assume-role --role-arn arn --role-session-name s"],
    ["an ecr login", "aws ecr get-login-password"],
    ["a decrypted parameter", "aws ssm get-parameter --name /x --with-decryption"],
    ["a service restart", "aws ecs update-service --cluster c --service s --force-new-deployment"],
    [
      "a log retention write",
      "aws logs put-retention-policy --log-group-name g --retention-in-days 30",
    ],
    ["an iam write", "aws iam create-user --user-name x"],
    ["aws configure", "aws configure set region eu-central-1"],
    ["an sso logout", "aws sso logout"],
    ["a payload file", "aws ecs run-task --cli-input-json file://task.json"],
    ["debug output", "aws sts get-caller-identity --debug"],
    ["a redirected endpoint", "aws s3api list-buckets --endpoint-url http://localhost:4566"],
    ["a log read with no window", "aws logs filter-log-events --log-group-name g --limit 10"],
    ["a log read with no limit", "aws logs filter-log-events --log-group-name g --start-time 1"],
    [
      "an oversized log read",
      "aws logs filter-log-events --log-group-name g --start-time 1 --limit 5000",
    ],
    ["a tofu apply", "tofu apply -auto-approve"],
    ["a tofu plan", "tofu plan"],
    ["a tofu init", "tofu init"],
    ["a state read", "tofu state list"],
    ["a terraform destroy", "terraform destroy"],
    ["the tf script", "pnpm tf:dev"],
    ["a databricks job run", "databricks jobs run-now --job-id 1"],
    ["a pipeline start", "databricks pipelines start-update --pipeline-id p"],
    ["a bundle deploy", "databricks bundle deploy -t dev"],
    ["a secret read", "databricks secrets get-secret --scope s --key k"],
    [
      "a non-select statement",
      "databricks statement-execution execute-statement --warehouse-id w --statement 'DROP TABLE t'",
    ],
    [
      "a stacked statement",
      "databricks statement-execution execute-statement --warehouse-id w --statement 'SELECT 1; DROP TABLE t'",
    ],
    ["an api write", "databricks api post /api/2.0/jobs/create"],
    ["a kubectl delete", "kubectl delete pod x"],
    ["a kubectl apply", "kubectl apply -f manifest.yaml"],
    [
      "a mutation hidden after a read",
      "aws ecs describe-services --cluster c && aws s3 rm s3://b/k",
    ],
    [
      "a mutation hidden in a pipe",
      "aws ecs list-clusters | xargs aws ecs delete-cluster --cluster",
    ],
    ["a shell wrapper", "bash -c 'aws s3 rm s3://b/k'"],
    ["inline credentials", "AWS_ACCESS_KEY_ID=x aws s3api list-buckets"],
    ["opening the prod window itself", "touch .claude/analyst-prod.ok"],
  ])("blocks %s", (_label, command) => {
    expect(check(command).blocked).toBe(true);
  });
});

describe("the CLI is found wherever it sits in the command", () => {
  it.each([
    ["a bare invocation", "aws s3 rm s3://b/k"],
    ["an env prefix", "env aws s3 rm s3://b/k"],
    ["an inline variable and a path", "env AWS_REGION=x /opt/aws s3 rm s3://b/k"],
    ["the command builtin", "command aws s3 rm s3://b/k"],
    ["an absolute path", "/usr/local/bin/aws s3 rm s3://b/k"],
    ["an escaped name", "\\aws s3 rm s3://b/k"],
    ["a timing wrapper", "time aws s3 rm s3://b/k"],
    ["nohup", "nohup aws s3 rm s3://b/k"],
    ["sudo", "sudo -E aws ecs update-service --service s"],
    ["a loop body", "for i in 1; do aws s3 rm s3://b/k; done"],
    ["command substitution", "$(which aws) s3 rm s3://b/k"],
  ])("still blocks a mutation behind %s", (_label, command) => {
    expect(check(command).blocked).toBe(true);
  });

  it.each([
    ["an env prefix", "env aws ecs list-clusters"],
    ["an absolute path", "/usr/local/bin/aws sts get-caller-identity"],
    ["an escaped name", "\\aws ecs list-clusters"],
  ])("still allows a read behind %s", (_label, command) => {
    expect(check(command).blocked).toBe(false);
  });
});

describe("quoted text is data, not a command", () => {
  it.each([
    'echo "a string mentioning aws s3 rm"',
    'git commit -m "fix the aws ecs update-service call"',
    "git commit -m 'tofu apply notes'",
  ])("leaves %s alone", (command) => {
    expect(check(command).blocked).toBe(false);
  });

  it("still reads the flags of a real command that carries quotes", () => {
    expect(check('aws ecs describe-services --cluster "backend-cluster-dev"').blocked).toBe(false);
    expect(check('aws s3 rm "s3://b/k"').blocked).toBe(true);
  });
});

describe("production", () => {
  it("refuses a production read with no window open", () => {
    const result = check("aws ecs describe-services --profile openjii-analyst-prod --cluster c");

    expect(result.blocked).toBe(true);
    expect(result.message).toContain("analyst:prod-window");
  });

  it("allows a production read while the window is open", () => {
    openProdWindow();

    expect(
      check("aws ecs describe-services --profile openjii-analyst-prod --cluster c").blocked,
    ).toBe(false);
  });

  it("refuses once the window has expired", () => {
    openProdWindow(7201);

    expect(
      check("aws ecs describe-services --profile openjii-analyst-prod --cluster c").blocked,
    ).toBe(true);
  });

  it("recognises production by environment root as well as by profile", () => {
    expect(check("cd infrastructure/env/prod && tofu fmt").blocked).toBe(true);
  });

  it.each([
    "aws logs filter-log-events --log-group-name /aws/ecs/backend-service-prod --start-time 1 --limit 10",
    "aws ecs describe-services --cluster backend-cluster-prod",
    "aws lambda get-function-configuration --function-name open-jii-prod-server",
    "databricks tables get open_jii_prod.centrum.raw_data",
  ])("recognises production in a resource name: %s", (command) => {
    expect(check(command).blocked).toBe(true);
  });

  it.each([
    "aws logs filter-log-events --log-group-name /aws/ecs/backend-service-dev --start-time 1 --limit 10",
    "aws ecs describe-services --cluster backend-cluster-dev --services backend-dev",
    "aws s3api list-objects-v2 --bucket open-jii-products --max-keys 1",
    "aws ecs list-tasks --cluster c --desired-status RUNNING",
  ])("does not mistake a development or similarly named resource for production: %s", (command) => {
    expect(check(command).blocked).toBe(false);
  });

  it("still refuses a production mutation with the window open", () => {
    openProdWindow();

    expect(check("aws ecs update-service --profile openjii-analyst-prod --service s").blocked).toBe(
      true,
    );
  });
});

describe("failure modes", () => {
  it("leaves a command with no cloud tool alone", () => {
    expect(check("echo hello").blocked).toBe(false);
    expect(check("").blocked).toBe(false);
  });

  it("does not care about a temporary directory", () => {
    const elsewhere = mkdtempSync(join(tmpdir(), "openjii-guard-"));

    expect(check(`ls ${elsewhere}`).blocked).toBe(false);
  });
});
