import {
  GetSecretValueCommand,
  PutSecretValueCommand,
  ResourceNotFoundException,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import {
  ListCommandInvocationsCommand,
  ListCommandsCommand,
  SSMClient,
  SendCommandCommand,
} from "@aws-sdk/client-ssm";
import { spawn } from "node:child_process";
import { text } from "node:stream/consumers";

import { optionAfter } from "../lib/args.js";

type Environment = "dev" | "prod";

interface ServingStoreUser {
  /** The ClickHouse user, whose name the store's users and grants are written with. */
  username: string;
  /** The key the pipelines read this user's password from in the `serving-store-<env>` scope. */
  scopeKey?: string;
  /** Who still holds the old password once the store has the new one. */
  restart: string;
}

interface SecretSpec {
  /** Secrets Manager, or a Databricks secret scope that holds one secret per key. */
  store?: "databricks";
  /** A serving store user, whose new password the store and the pipelines' scope must take too. */
  servingStore?: ServingStoreUser;
  name: (env: Environment) => string;
  keys: readonly string[] | null;
}

/**
 * The secrets OpenTofu creates without a value (infrastructure/modules/secrets-manager/container), by the
 * short name this command takes. A JSON secret lists its keys, so a misspelt key fails here rather
 * than in the service that reads it. A plain secret is the value itself. A Databricks scope's keys
 * are separate secrets that the pipelines read.
 */
export const secrets = {
  auth: {
    name: (env: Environment) => `openjii-auth-secrets-${env}`,
    keys: [
      "AUTH_SECRET",
      "NOTIFICATION_UNSUBSCRIBE_SECRET",
      "AUTH_GITHUB_ID",
      "AUTH_GITHUB_SECRET",
      "AUTH_ORCID_ID",
      "AUTH_ORCID_SECRET",
    ],
  },
  contentful: {
    name: (env: Environment) => `openjii-contentful-secrets-${env}`,
    keys: [
      "CONTENTFUL_SPACE_ID",
      "CONTENTFUL_ACCESS_TOKEN",
      "CONTENTFUL_PREVIEW_ACCESS_TOKEN",
      "CONTENTFUL_PREVIEW_SECRET",
    ],
  },
  mailchimp: {
    name: (env: Environment) => `openjii-mailchimp-secrets-${env}`,
    keys: [
      "MAILCHIMP_API_KEY",
      "MAILCHIMP_SERVER_PREFIX",
      "MAILCHIMP_AUDIENCE_ID",
      "MAILCHIMP_COMMUNITY_KIND",
      "MAILCHIMP_COMMUNITY_ID",
      "MAILCHIMP_COMMUNITY_NAME",
    ],
  },
  "status-contentful": {
    name: (env: Environment) => `openjii-status-contentful-${env}`,
    keys: ["CONTENTFUL_SPACE_ID", "CONTENTFUL_ACCESS_TOKEN"],
  },
  "status-slack": {
    name: (env: Environment) => `openjii-status-slack-${env}`,
    keys: null,
  },
  databricks: {
    name: (env: Environment) => `openjii-databricks-secrets-${env}`,
    keys: [
      "DATABRICKS_CLIENT_SECRET",
      "DATABRICKS_WEBHOOK_API_KEY_ID",
      "DATABRICKS_WEBHOOK_API_KEY",
      "DATABRICKS_WEBHOOK_SECRET",
    ],
  },
  ses: {
    name: (env: Environment) => `openjii-ses-secrets-${env}`,
    keys: ["AUTH_EMAIL_SERVER", "BACKEND_EMAIL_SERVER"],
  },
  "play-review": {
    name: (env: Environment) => `openjii-play-review-sign-in-${env}`,
    keys: ["AUTH_PLAY_REVIEW_EMAIL", "AUTH_PLAY_REVIEW_OTP"],
  },
  "serving-store-admin": {
    name: (env: Environment) => `openjii-serving-store-${env}-admin`,
    keys: ["username", "password"],
    servingStore: {
      username: "openjii_admin",
      restart: "Nothing to restart: the migration runner reads it on its next run.",
    },
  },
  "serving-store-writer": {
    name: (env: Environment) => `openjii-serving-store-${env}-writer`,
    keys: ["username", "password"],
    servingStore: {
      username: "openjii_writer",
      scopeKey: "writer-password",
      restart: "Nothing to restart: the pipelines' feed reads the scope on every write.",
    },
  },
  "serving-store-reloader": {
    name: (env: Environment) => `openjii-serving-store-${env}-reloader`,
    keys: ["username", "password"],
    servingStore: {
      username: "openjii_reloader",
      scopeKey: "reloader-password",
      restart: "Nothing to restart: the next reload reads the scope.",
    },
  },
  "serving-store-reader": {
    name: (env: Environment) => `openjii-serving-store-${env}-reader`,
    keys: ["username", "password"],
    servingStore: {
      username: "openjii_reader",
      restart: "Redeploy the backend now; it reads the secret when a task starts.",
    },
  },
  "webhook-scope": {
    store: "databricks",
    name: (env: Environment) => `node-webhook-secret-scope-${env}`,
    keys: ["webhook_api_key_id", "webhook_secret"],
  },
  "serving-store-scope": {
    store: "databricks",
    name: (env: Environment) => `serving-store-${env}`,
    keys: ["writer-password", "reloader-password"],
  },
} as const satisfies Record<string, SecretSpec>;

type SecretName = keyof typeof secrets;

const USAGE =
  `Usage: secrets:set <dev|prod> <${Object.keys(secrets).join("|")}> [--key <KEY>] ` +
  "[--aws-profile <name>] [--databricks-profile <name>], with the value on stdin";

export interface SecretsSetArgs {
  environment: Environment;
  secret: SecretName;
  key: string | null;
  awsProfile: string;
  databricksProfile: string;
}

export interface SecretsSetDependencies {
  readInput: () => Promise<string>;
  /** The secret's current string, or null when it has no value yet. */
  read: (name: string) => Promise<string | null>;
  put: (name: string, value: string) => Promise<void>;
  /** Writes one key of a Databricks secret scope. */
  putScoped: (scope: string, key: string, value: string) => Promise<void>;
  /** Has the serving store instance with this Name tag reread its users' passwords. */
  reloadServingStore: (instanceName: string) => Promise<void>;
  write: (text: string) => void;
}

function isSecretName(value: string): value is SecretName {
  return Object.hasOwn(secrets, value);
}

export function parseArgs(given: string[]): SecretsSetArgs {
  // The root alias passes a `--` through ahead of the arguments.
  const args = given[0] === "--" ? given.slice(1) : given;
  const [environment, secret] = args;
  if ((environment !== "dev" && environment !== "prod") || !secret || !isSecretName(secret)) {
    throw new Error(USAGE);
  }
  for (const arg of args.slice(2)) {
    if (
      arg.startsWith("--") &&
      arg !== "--key" &&
      arg !== "--aws-profile" &&
      arg !== "--databricks-profile"
    ) {
      throw new Error(`Unknown argument ${arg}. ${USAGE}`);
    }
  }
  return {
    environment,
    secret,
    key: optionAfter(args, "--key"),
    awsProfile: optionAfter(args, "--aws-profile") ?? `openjii-${environment}`,
    databricksProfile: optionAfter(args, "--databricks-profile") ?? environment,
  };
}

export function parseObject(name: string, current: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(current);
  } catch {
    throw new Error(`${name} does not hold a JSON object; refusing to replace it`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${name} does not hold a JSON object; refusing to replace it`);
  }
  return parsed as Record<string, unknown>;
}

export async function setSecret(args: SecretsSetArgs, deps: SecretsSetDependencies): Promise<void> {
  const spec: SecretSpec = secrets[args.secret];
  const name = spec.name(args.environment);
  const { key } = args;

  if (spec.keys === null && key !== null) {
    throw new Error(`${args.secret} holds a single value; leave out --key`);
  }
  if (spec.keys !== null && key === null) {
    throw new Error(`${args.secret} needs --key, one of ${spec.keys.join(", ")}`);
  }
  if (spec.keys !== null && key !== null && !spec.keys.includes(key)) {
    throw new Error(`${args.secret} has no key ${key}; use one of ${spec.keys.join(", ")}`);
  }

  // Only the line break a paste or `echo` adds goes; anything else is part of the value.
  const value = (await deps.readInput()).replace(/\r?\n$/, "");
  if (value.length === 0) {
    throw new Error(
      "No value received on stdin. Pipe it in, for example pbpaste | pnpm secrets:set",
    );
  }
  // The store's users are named in OpenTofu, so any other name would sign in as nobody.
  if (spec.servingStore && key === "username" && value !== spec.servingStore.username) {
    throw new Error(`${args.secret}'s username is ${spec.servingStore.username}; nothing was set`);
  }

  if ("store" in spec && spec.store === "databricks" && key !== null) {
    await deps.putScoped(name, key, value);
    deps.write(`Set ${key} in the Databricks secret scope ${name}\n`);
    return;
  }

  if (spec.keys === null || key === null) {
    await deps.put(name, value);
    deps.write(`Set ${name}\n`);
    return;
  }

  const current = await deps.read(name);
  const object = current === null ? {} : parseObject(name, current);
  object[key] = value;
  await deps.put(name, JSON.stringify(object));

  // An empty string counts as unset: the service reading it would start without the value.
  const missing = spec.keys.filter((key) => typeof object[key] !== "string" || object[key] === "");
  deps.write(
    `Set ${key} in ${name}` +
      (missing.length > 0 ? `; still without a value: ${missing.join(", ")}` : "") +
      "\n",
  );

  if (spec.servingStore && key === "password") {
    await passToServingStore(args.environment, spec.servingStore, value, deps);
  }
}

/**
 * The scope first, the store last. The feed reads its scope on every write, so from the scope write
 * until the store rereads its passwords the writer fails; a failure in between is put right by
 * running the command again with the same value, never a new one.
 */
async function passToServingStore(
  env: Environment,
  user: ServingStoreUser,
  value: string,
  deps: SecretsSetDependencies,
): Promise<void> {
  const scope = `serving-store-${env}`;
  const instance = `openjii-serving-store-${env}`;
  const holders = ["the Secrets Manager secret"];
  try {
    if (user.scopeKey) {
      await deps.putScoped(scope, user.scopeKey, value);
      holders.push(`${user.scopeKey} in ${scope}`);
      deps.write(`Set ${user.scopeKey} in the Databricks secret scope ${scope}\n`);
    }
    await deps.reloadServingStore(instance);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${reason}\n${holders.join(" and ")} already ${holders.length > 1 ? "hold" : "holds"} ` +
        "the new password, and the store may take " +
        "it too if its script is still running. Run the command again with the same password, " +
        "not a new one.",
    );
  }
  deps.write(`${instance} now accepts the new password. ${user.restart}\n`);
}

export function secretsManager(profile: string) {
  // The secrets live in eu-central-1 in both accounts, whatever region the profile names.
  const client = new SecretsManagerClient({ profile, region: "eu-central-1" });
  return {
    read: async (name: string): Promise<string | null> => {
      try {
        const response = await client.send(new GetSecretValueCommand({ SecretId: name }));
        return response.SecretString ?? null;
      } catch (error) {
        // A secret OpenTofu has just created has no version until its first value.
        if (error instanceof ResourceNotFoundException && /secret value/i.test(error.message)) {
          return null;
        }
        throw error;
      }
    },
    put: async (name: string, value: string): Promise<void> => {
      await client.send(new PutSecretValueCommand({ SecretId: name, SecretString: value }));
    },
  };
}

/**
 * Writes one scope key through the Databricks CLI, which holds the profile's credentials. The value
 * goes on the CLI's stdin, so it never appears in a process listing.
 */
function databricksScopes(profile: string) {
  return (scope: string, key: string, value: string): Promise<void> =>
    new Promise((resolve, reject) => {
      const child = spawn("databricks", ["secrets", "put-secret", scope, key, "-p", profile], {
        stdio: ["pipe", "ignore", "pipe"],
      });
      let stderr = "";
      child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve();
        else
          reject(
            new Error(`databricks secrets put-secret ${scope} ${key} failed: ${stderr.trim()}`),
          );
      });
      child.stdin.end(value);
    });
}

// Written by the store's boot configuration (modules/serving-store/templates/cloud-config.yaml.tftpl).
const PASSWORDS_SCRIPT = "/usr/local/bin/openjii-clickhouse-passwords";

/** The three SSM Run Command calls the reload needs, apart so a test can stand in for them. */
export interface SsmCommands {
  /** Sends the script to every instance with this Name tag and returns the command id. */
  run: (instanceName: string, script: string) => Promise<string>;
  status: (commandId: string) => Promise<{ status?: string; targetCount?: number }>;
  /** What the script printed on each instance, for the error when it fails. */
  output: (commandId: string) => Promise<string>;
}

export function ssmCommands(profile: string): SsmCommands {
  const client = new SSMClient({ profile, region: "eu-central-1" });
  return {
    run: async (instanceName, script) => {
      const sent = await client.send(
        new SendCommandCommand({
          DocumentName: "AWS-RunShellScript",
          Targets: [{ Key: "tag:Name", Values: [instanceName] }],
          Parameters: { commands: [script] },
          Comment: "pnpm secrets:set: reread the serving store passwords",
        }),
      );
      if (!sent.Command?.CommandId)
        throw new Error(`SSM returned no command id for ${instanceName}`);
      return sent.Command.CommandId;
    },
    status: async (commandId) => {
      const listed = await client.send(new ListCommandsCommand({ CommandId: commandId }));
      const command = listed.Commands?.[0];
      return { status: command?.Status, targetCount: command?.TargetCount };
    },
    output: async (commandId) => {
      const listed = await client.send(
        new ListCommandInvocationsCommand({ CommandId: commandId, Details: true }),
      );
      return (listed.CommandInvocations ?? [])
        .flatMap((invocation) => invocation.CommandPlugins ?? [])
        .map((plugin) => plugin.Output?.trim() ?? "")
        .filter((output) => output !== "")
        .join("\n");
    },
  };
}

/**
 * Runs the store's passwords script through SSM Run Command, so nobody needs a shell on the
 * instance, and waits for the outcome. ClickHouse rereads the file it writes without a restart.
 */
export function servingStoreReloader(
  ssm: SsmCommands,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  return async (instanceName: string): Promise<void> => {
    const commandId = await ssm.run(instanceName, PASSWORDS_SCRIPT);
    for (let attempt = 0; attempt < 60; attempt++) {
      await sleep(2000);
      const { status, targetCount } = await ssm.status(commandId);
      if (status === undefined || status === "Pending" || status === "InProgress") continue;
      if (targetCount === 0) {
        throw new Error(`No instance tagged Name=${instanceName} is reachable through SSM`);
      }
      if (status === "Success") return;
      const output = await ssm.output(commandId);
      throw new Error(
        `The passwords script on ${instanceName} ended ${status}` + (output ? `:\n${output}` : ""),
      );
    }
    throw new Error(`The passwords script on ${instanceName} did not finish within two minutes`);
  };
}

async function run(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (process.stdin.isTTY) {
    throw new Error(
      "The value is read from stdin so it never lands on a command line or in shell history: " +
        "pipe it in, for example pbpaste | pnpm secrets:set ...",
    );
  }
  const store = secretsManager(args.awsProfile);
  await setSecret(args, {
    readInput: () => text(process.stdin),
    read: store.read,
    put: store.put,
    putScoped: databricksScopes(args.databricksProfile),
    reloadServingStore: servingStoreReloader(ssmCommands(args.awsProfile)),
    write: (output) => {
      process.stdout.write(output);
    },
  });
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run();
}
