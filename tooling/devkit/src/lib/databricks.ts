import { execFile } from "node:child_process";
import { promisify } from "node:util";

export interface StatementParameter {
  name: string;
  value: string;
  type?: string;
}

export interface Warehouse {
  /** Every row a read-only statement returns, each value as text or null. */
  rows(statement: string, parameters: StatementParameter[]): Promise<(string | null)[][]>;
}

/** Runs `databricks <args>` and returns its standard output. */
export type DatabricksCli = (args: string[]) => Promise<string>;

const execFileAsync = promisify(execFile);

// The Databricks CLI holds the profile's credentials, so no token passes through this process.
const runCli: DatabricksCli = async (args) => {
  const { stdout } = await execFileAsync("databricks", args, { maxBuffer: 256 * 1024 * 1024 });
  return stdout;
};

const POLL_MS = 2000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rowsOf(result: unknown): (string | null)[][] {
  if (!isRecord(result) || !Array.isArray(result.data_array)) return [];
  return result.data_array.map((row: unknown) =>
    Array.isArray(row)
      ? row.map((value: unknown) => (typeof value === "string" ? value : null))
      : [],
  );
}

export function createWarehouse(
  profile: string,
  warehouseId: string,
  cli: DatabricksCli = runCli,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Warehouse {
  async function api(method: "get" | "post", path: string, body?: unknown): Promise<unknown> {
    const args = ["api", method, path, "-p", profile];
    if (body !== undefined) args.push("--json", JSON.stringify(body));
    const parsed: unknown = JSON.parse(await cli(args));
    return parsed;
  }

  return {
    async rows(statement, parameters) {
      let response = await api("post", "/api/2.0/sql/statements", {
        warehouse_id: warehouseId,
        statement,
        parameters,
        wait_timeout: "30s",
        on_wait_timeout: "CONTINUE",
        format: "JSON_ARRAY",
        disposition: "INLINE",
      });

      while (isRecord(response)) {
        const status = isRecord(response.status) ? response.status : {};
        const state = typeof status.state === "string" ? status.state : "UNKNOWN";
        if (state !== "PENDING" && state !== "RUNNING") break;
        await wait(POLL_MS);
        response = await api("get", `/api/2.0/sql/statements/${String(response.statement_id)}`);
      }

      if (!isRecord(response)) throw new Error("The warehouse answered with something unreadable");
      const status = isRecord(response.status) ? response.status : {};
      if (status.state !== "SUCCEEDED") {
        const error = isRecord(status.error) ? String(status.error.message) : "no message";
        throw new Error(`The statement ended ${String(status.state)}: ${error}`);
      }

      const manifest = isRecord(response.manifest) ? response.manifest : {};
      if (manifest.truncated === true) {
        throw new Error("The warehouse cut the result short; narrow the window and run again");
      }

      const rows = rowsOf(response.result);
      const chunks =
        typeof manifest.total_chunk_count === "number" ? manifest.total_chunk_count : 1;
      for (let chunk = 1; chunk < chunks; chunk += 1) {
        const next = await api(
          "get",
          `/api/2.0/sql/statements/${String(response.statement_id)}/result/chunks/${chunk}`,
        );
        rows.push(...rowsOf(next));
      }
      return rows;
    },
  };
}
