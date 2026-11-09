import { describe, expect, it, vi } from "vitest";

import { createWarehouse } from "./databricks.js";
import type { DatabricksCli } from "./databricks.js";

function cli(...answers: unknown[]): DatabricksCli & { calls: string[][] } {
  const calls: string[][] = [];
  const fn = vi.fn((args: string[]) => {
    calls.push(args);
    return Promise.resolve(JSON.stringify(answers.shift()));
  });
  return Object.assign(fn, { calls });
}

const wait = () => Promise.resolve();

describe("createWarehouse", () => {
  it("waits for the statement, then reads every chunk of its rows", async () => {
    const databricks = cli(
      { statement_id: "s1", status: { state: "PENDING" } },
      {
        statement_id: "s1",
        status: { state: "SUCCEEDED" },
        manifest: { total_chunk_count: 2 },
        result: { data_array: [["a", "1"]] },
      },
      { data_array: [["b", null]] },
    );

    const rows = await createWarehouse("dev", "w1", databricks, wait).rows("SELECT 1", [
      { name: "x", value: "1" },
    ]);

    expect(rows).toEqual([
      ["a", "1"],
      ["b", null],
    ]);
    expect(databricks.calls[0].slice(0, 5)).toEqual([
      "api",
      "post",
      "/api/2.0/sql/statements",
      "-p",
      "dev",
    ]);
    expect(JSON.parse(databricks.calls[0][6])).toEqual(
      expect.objectContaining({
        warehouse_id: "w1",
        statement: "SELECT 1",
        parameters: [{ name: "x", value: "1" }],
      }),
    );
    expect(databricks.calls[2][2]).toBe("/api/2.0/sql/statements/s1/result/chunks/1");
  });

  it("refuses a result the warehouse cut short, and a statement that failed", async () => {
    const truncated = cli({
      statement_id: "s1",
      status: { state: "SUCCEEDED" },
      manifest: { truncated: true },
      result: { data_array: [] },
    });
    const failed = cli({
      statement_id: "s2",
      status: { state: "FAILED", error: { message: "TABLE_OR_VIEW_NOT_FOUND" } },
    });

    await expect(
      createWarehouse("dev", "w1", truncated, wait).rows("SELECT 1", []),
    ).rejects.toThrow("narrow the window");
    await expect(createWarehouse("dev", "w1", failed, wait).rows("SELECT 1", [])).rejects.toThrow(
      "FAILED: TABLE_OR_VIEW_NOT_FOUND",
    );
  });
});
