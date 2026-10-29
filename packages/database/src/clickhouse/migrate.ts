import { ClickHouseError, ClickHouseLogLevel, createClient } from "@clickhouse/client";
import { migration } from "clickhouse-migrations";
import { readdir } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { z } from "zod";

const DATABASE = "store";
const MIGRATIONS_FOLDER = "clickhouse/migrations";

// The store's instance may just have been replaced, so it gets a few minutes to boot.
const READY_TIMEOUT_MS = 5 * 60 * 1000;
const READY_POLL_MS = 5 * 1000;

// Without it the client gives up after 30 seconds while the server finishes the statement, and the
// next run applies it again. Work that takes longer belongs in a runbook, not a migration.
const STATEMENT_TIMEOUT_MS = 8 * 60 * 1000;

// The runner's ledger keeps a version as a UInt32.
const MAX_VERSION = 4_294_967_295;

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

      // The server answered, with an error such as a wrong password, so waiting will not change it.
      if (result.error instanceof ClickHouseError) {
        throw new Error(`ClickHouse refused the runner: ${result.error.message}`);
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

// The runner records a migration under the number before its first underscore. It exits on a zero or
// a missing number, records one past UInt32 as a different number that no file has, and on a second
// file with the same number fails every later run on a checksum mismatch.
export async function checkClickHouseMigrations() {
  const files = (await readdir(MIGRATIONS_FOLDER)).filter((file) => file.endsWith(".sql"));
  const byNumber = new Map<number, string>();

  for (const file of files) {
    const number = Number(file.split("_")[0]);
    if (!Number.isInteger(number) || number < 1 || number > MAX_VERSION) {
      throw new Error(
        `ClickHouse migration ${file} needs a whole number from 1 to ${MAX_VERSION} before its first underscore`,
      );
    }

    const other = byNumber.get(number);
    if (other !== undefined) {
      throw new Error(`ClickHouse migrations ${other} and ${file} share the number ${number}`);
    }

    byNumber.set(number, file);
  }
}

export async function migrateClickHouse({ url, username, password }: ClickHouseConfig) {
  await migration(
    MIGRATIONS_FOLDER,
    url,
    username,
    password,
    DATABASE,
    undefined,
    undefined,
    String(STATEMENT_TIMEOUT_MS),
  );
}
