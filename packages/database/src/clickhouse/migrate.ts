import { ClickHouseLogLevel, createClient } from "@clickhouse/client";
import { migration } from "clickhouse-migrations";
import { readdir } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { z } from "zod";

const DATABASE = "store";
const MIGRATIONS_FOLDER = "clickhouse/migrations";

// The store's instance may just have been replaced, so it gets a few minutes to boot.
const READY_TIMEOUT_MS = 5 * 60 * 1000;
const READY_POLL_MS = 5 * 1000;

// A fixed message, since JSON.parse quotes the start of its input and this input is a secret.
const credentialsSchema = z
  .string()
  .transform((value, ctx) => {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "is not JSON" });
      return z.NEVER;
    }
  })
  .pipe(z.object({ username: z.string(), password: z.string() }));

const configSchema = z.object({
  CLICKHOUSE_URL: z.string().url(),
  CLICKHOUSE_CREDENTIALS: credentialsSchema,
});

export interface ClickHouseConfig {
  url: string;
  username: string;
  password: string;
}

// An environment without a serving store, such as DR, leaves CLICKHOUSE_URL unset.
export function readClickHouseConfig(env: NodeJS.ProcessEnv): ClickHouseConfig | null {
  if (env.CLICKHOUSE_URL === undefined) {
    return null;
  }

  const { CLICKHOUSE_URL, CLICKHOUSE_CREDENTIALS } = configSchema.parse(env);

  return { url: CLICKHOUSE_URL, ...CLICKHOUSE_CREDENTIALS };
}

export async function waitForClickHouse({ url, username, password }: ClickHouseConfig) {
  // A failed ping logs a warning by default, which would repeat on every poll.
  const client = createClient({
    url,
    username,
    password,
    log: { level: ClickHouseLogLevel.ERROR },
  });
  const deadline = Date.now() + READY_TIMEOUT_MS;

  console.log(`Waiting for ClickHouse at ${url}`);

  try {
    for (;;) {
      // A SELECT rather than /ping, which answers without checking the credentials.
      const result = await client.ping({ select: true });
      if (result.success) {
        return;
      }

      if (Date.now() > deadline) {
        throw new Error(`ClickHouse did not answer in time: ${result.error.message}`);
      }

      await setTimeout(READY_POLL_MS);
    }
  } finally {
    await client.close();
  }
}

// The runner records a migration under the number before its first underscore, so a second file
// with the same number fails every later run on a checksum mismatch.
export async function checkClickHouseMigrations() {
  const files = (await readdir(MIGRATIONS_FOLDER)).filter((file) => file.endsWith(".sql"));
  const byNumber = new Map<number, string>();

  for (const file of files) {
    const number = Number(file.split("_")[0]);
    const other = byNumber.get(number);
    if (other !== undefined) {
      throw new Error(`ClickHouse migrations ${other} and ${file} share the number ${number}`);
    }

    byNumber.set(number, file);
  }
}

export async function migrateClickHouse({ url, username, password }: ClickHouseConfig) {
  await migration(MIGRATIONS_FOLDER, url, username, password, DATABASE);
}
