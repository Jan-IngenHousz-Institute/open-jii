import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../../..", import.meta.url));

/** Hook events either file may leave out, which is why every lookup can come back empty. */
type HookMap = Record<string, { hooks: { command: string }[] }[] | undefined>;

interface ClaudeSettings {
  permissions: { deny: string[]; ask: string[] };
  hooks: HookMap;
}

interface CodexHooks {
  hooks: HookMap;
}

const claude = JSON.parse(
  readFileSync(join(root, ".claude/settings.json"), "utf8"),
) as ClaudeSettings;
const codexHooks = JSON.parse(readFileSync(join(root, ".codex/hooks.json"), "utf8")) as CodexHooks;
const codexRules = readFileSync(join(root, ".codex/rules/openjii.rules"), "utf8");

/** The command words of each Codex rule, expanding a list of alternatives into one entry each. */
function codexPrefixes(decision: string): string[] {
  const prefixes: string[] = [];
  for (const rule of codexRules.matchAll(/prefix_rule\(([\s\S]*?)\n\)/g)) {
    const body = String(rule[1]);
    if (!body.includes(`decision = "${decision}"`)) continue;
    const pattern = /pattern = \[(.*)\],/.exec(body)?.[1] ?? "";
    let expanded = [""];
    for (const part of pattern.matchAll(/\[([^\]]*)\]|"([^"]*)"/g)) {
      const options = part[1]
        ? [...part[1].matchAll(/"([^"]*)"/g)].map((m) => String(m[1]))
        : [String(part[2])];
      expanded = expanded.flatMap((head) => options.map((o) => `${head} ${o}`.trim()));
    }
    prefixes.push(...expanded);
  }
  return prefixes;
}

/** Bash rules written as a plain command prefix, which a Codex prefix rule can express too. */
function claudePrefixes(list: string[]): string[] {
  return list
    .map((rule) => /^Bash\((.*) \*\)$/.exec(rule)?.[1])
    .filter((prefix): prefix is string => prefix !== undefined && !prefix.includes("*"));
}

interface PolicyStatement {
  Sid: string;
  Effect: "Allow" | "Deny";
  Action: string | string[];
}

const policyText = readFileSync(join(root, "infrastructure/policies/openjii-analyst.json"), "utf8");
const policy = JSON.parse(policyText) as { Statement: PolicyStatement[] };
const actions = (s: PolicyStatement) => (Array.isArray(s.Action) ? s.Action : [s.Action]);
const denied = policy.Statement.filter((s) => s.Effect === "Deny").flatMap(actions);

/** IAM's own wildcard matching, enough to ask whether a deny covers an action. */
const covers = (pattern: string, action: string) =>
  new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`, "i").test(
    action,
  );

/** The IAM action behind each call the cloud guard refuses as a data read or credential mint. */
const GUARD_REFUSALS = [
  "s3:GetObject",
  "secretsmanager:GetSecretValue",
  "dynamodb:GetItem",
  "dynamodb:BatchGetItem",
  "kinesis:GetRecords",
  "kinesis:GetShardIterator",
  "ecr:GetAuthorizationToken",
  "iot:GetThingShadow",
  "cognito-identity:GetCredentialsForIdentity",
  "cognito-identity:GetId",
  "sts:GetSessionToken",
  "sts:GetFederationToken",
  "sts:AssumeRole",
  "sts:AssumeRoleWithWebIdentity",
  "sso:GetRoleCredentials",
  "ecs:ExecuteCommand",
  "lambda:InvokeFunction",
  "ssm:StartSession",
  "ssm:SendCommand",
  "logs:StartLiveTail",
  "logs:CreateExportTask",
  "rds:DownloadDBLogFilePortion",
  "kms:Decrypt",
];

describe("the analyst permission set", () => {
  it("fits the inline policy limit once whitespace is removed", () => {
    expect(policyText.replace(/\s/g, "").length).toBeLessThan(10240);
  });

  it("grants only reads in its allow statements", () => {
    const granted = policy.Statement.filter((s) => s.Effect === "Allow").flatMap(actions);

    for (const action of granted) {
      expect(action).toMatch(
        /^[a-z0-9-]+:(Describe|List|Get|LookupEvents|View|Simulate|FilterLogEvents|StartQuery|StopQuery|GET$)/,
      );
    }
  });

  it("never uses a service wildcard, which IAM rejects", () => {
    expect(
      [...denied, ...policy.Statement.flatMap(actions)].filter((a) => a.startsWith("*:")),
    ).toEqual([]);
  });

  it("denies every data read and credential mint the cloud guard refuses", () => {
    const uncovered = GUARD_REFUSALS.filter((action) => !denied.some((d) => covers(d, action)));

    expect(uncovered).toEqual([]);
  });
});

const hookCommands = (hooks: HookMap) =>
  (hooks.PreToolUse ?? []).flatMap((entry) => entry.hooks.map((h) => h.command)).join("\n");

describe("Claude Code and Codex enforce the same lines", () => {
  it("runs the main guard and the cloud guard in both tools", () => {
    for (const commands of [hookCommands(claude.hooks), hookCommands(codexHooks.hooks)]) {
      expect(commands).toContain("protect-main.sh");
      expect(commands).toContain("analyst-guard.sh");
    }
  });

  it("forbids in Codex every command prefix Claude Code denies", () => {
    expect(codexPrefixes("forbidden").sort()).toEqual(
      claudePrefixes(claude.permissions.deny).sort(),
    );
  });

  it("prompts in Codex for every command prefix Claude Code asks about", () => {
    expect(codexPrefixes("prompt").sort()).toEqual(claudePrefixes(claude.permissions.ask).sort());
  });
});
