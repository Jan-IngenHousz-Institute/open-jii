import { createHmac } from "node:crypto";
import { text } from "node:stream/consumers";

import { optionAfter } from "../lib/args.js";
import { secretsManager } from "./secrets-set.js";
import type { SecretsSetDependencies } from "./secrets-set.js";

type Environment = "dev" | "prod";

// SES's SMTP endpoint lives in the same region as the secrets, in both accounts.
const REGION = "eu-central-1";

const USAGE =
  "Usage: aws iam create-access-key --user-name <env>-ses-smtp-user | " +
  "pnpm secrets:ses-smtp <dev|prod> [--aws-profile <name>]";

export interface SesSmtpArgs {
  environment: Environment;
  awsProfile: string;
}

export function parseArgs(given: string[]): SesSmtpArgs {
  const args = given[0] === "--" ? given.slice(1) : given;
  const [environment] = args;
  if (environment !== "dev" && environment !== "prod") {
    throw new Error(USAGE);
  }
  for (const arg of args.slice(1)) {
    if (arg.startsWith("--") && arg !== "--aws-profile") {
      throw new Error(`Unknown argument ${arg}. ${USAGE}`);
    }
  }
  return {
    environment,
    awsProfile: optionAfter(args, "--aws-profile") ?? `openjii-${environment}`,
  };
}

/** SES's SMTP password for an IAM secret access key, by AWS's documented derivation. */
export function smtpPassword(secretAccessKey: string, region: string): string {
  let signature = createHmac("sha256", `AWS4${secretAccessKey}`).update("11111111").digest();
  for (const part of [region, "ses", "aws4_request", "SendRawEmail"]) {
    signature = createHmac("sha256", signature).update(part).digest();
  }
  return Buffer.concat([Buffer.from([0x04]), signature]).toString("base64");
}

function accessKeyOf(input: string): { id: string; secret: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error(`stdin is not the JSON that aws iam create-access-key prints. ${USAGE}`);
  }
  const key =
    typeof parsed === "object" && parsed !== null && "AccessKey" in parsed
      ? parsed.AccessKey
      : undefined;
  if (
    typeof key !== "object" ||
    key === null ||
    !("AccessKeyId" in key) ||
    !("SecretAccessKey" in key) ||
    typeof key.AccessKeyId !== "string" ||
    typeof key.SecretAccessKey !== "string"
  ) {
    throw new Error(`stdin has no AccessKey with an id and a secret. ${USAGE}`);
  }
  return { id: key.AccessKeyId, secret: key.SecretAccessKey };
}

/**
 * Stores the SMTP address built from a new access key as both of the backend's email servers. The
 * access key id is not secret, so it is printed for deleting the old key afterwards; the password
 * is never printed.
 */
export async function setSesSmtp(
  args: SesSmtpArgs,
  deps: Pick<SecretsSetDependencies, "readInput" | "read" | "put" | "write">,
): Promise<void> {
  const { id, secret } = accessKeyOf(await deps.readInput());
  const server =
    `smtp://${encodeURIComponent(id)}:${encodeURIComponent(smtpPassword(secret, REGION))}` +
    `@email-smtp.${REGION}.amazonaws.com:587`;

  const name = `openjii-ses-secrets-${args.environment}`;
  const current = await deps.read(name);
  let object: Record<string, unknown> = {};
  if (current !== null) {
    const parsed: unknown = JSON.parse(current);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error(`${name} does not hold a JSON object; refusing to replace it`);
    }
    object = parsed as Record<string, unknown>;
  }
  object.AUTH_EMAIL_SERVER = server;
  object.BACKEND_EMAIL_SERVER = server;
  await deps.put(name, JSON.stringify(object));
  deps.write(
    `Set AUTH_EMAIL_SERVER and BACKEND_EMAIL_SERVER in ${name} with access key ${id}. ` +
      "Redeploy the backend, then delete the user's older key.\n",
  );
}

async function run(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (process.stdin.isTTY) {
    throw new Error(`Pipe the new access key in. ${USAGE}`);
  }
  const store = secretsManager(args.awsProfile);
  await setSesSmtp(args, {
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
