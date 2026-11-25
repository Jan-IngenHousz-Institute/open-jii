import {
  GetSecretValueCommand,
  PutSecretValueCommand,
  ResourceNotFoundException,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { text } from "node:stream/consumers";

import { optionAfter } from "../lib/args.js";

type Environment = "dev" | "prod";

interface SecretSpec {
  name: (env: Environment) => string;
  keys: readonly string[] | null;
}

/**
 * The secrets OpenTofu creates without a value (infrastructure/modules/secrets-manager/container), by the
 * short name this command takes. A JSON secret lists its keys, so a misspelt key fails here rather
 * than in the service that reads it. A plain secret is the value itself.
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
} as const satisfies Record<string, SecretSpec>;

type SecretName = keyof typeof secrets;

const USAGE =
  `Usage: secrets:set <dev|prod> <${Object.keys(secrets).join("|")}> [--key <KEY>] ` +
  "[--aws-profile <name>], with the value on stdin";

export interface SecretsSetArgs {
  environment: Environment;
  secret: SecretName;
  key: string | null;
  awsProfile: string;
}

export interface SecretsSetDependencies {
  readInput: () => Promise<string>;
  /** The secret's current string, or null when it has no value yet. */
  read: (name: string) => Promise<string | null>;
  put: (name: string, value: string) => Promise<void>;
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
    if (arg.startsWith("--") && arg !== "--key" && arg !== "--aws-profile") {
      throw new Error(`Unknown argument ${arg}. ${USAGE}`);
    }
  }
  return {
    environment,
    secret,
    key: optionAfter(args, "--key"),
    awsProfile: optionAfter(args, "--aws-profile") ?? `openjii-${environment}`,
  };
}

function parseObject(name: string, current: string): Record<string, unknown> {
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
}

function secretsManager(profile: string) {
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
    write: (output) => {
      process.stdout.write(output);
    },
  });
  return 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run();
}
