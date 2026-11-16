import { describe, expect, it } from "vitest";

import { bronzeProgressQuery, contentQuery, recordIdQuery } from "./ingest-replay-bronze.js";

const experiment = "11111111-1111-4111-8111-111111111111";

describe("bronze lookups", () => {
  it("finds a record id in any experiment, parsed or not", () => {
    const query = recordIdQuery("t", ["a", "b"], "2026-10-06");

    expect(query.statement).not.toContain("experiment_id");
    expect(query.statement).not.toContain("parsed_data");
    expect(query.parameters).toEqual([
      { name: "since", value: "2026-10-06", type: "DATE" },
      { name: "record_0", value: "a" },
      { name: "record_1", value: "b" },
    ]);
  });

  it("matches content only on rows without a record id, at the exact milliseconds asked", () => {
    const query = contentQuery("t", [experiment], [1, 2], "2026-10-06");

    expect(query.statement).toContain("(_client_id IS NULL OR _client_id = '')");
    expect(query.statement).toContain("unix_millis(parsed_data.timestamp) IN (:time_0, :time_1)");
    expect(query.parameters).toContainEqual({ name: "time_1", value: "2", type: "BIGINT" });
  });

  it("measures bronze's progress on each shard it read in the stream's retention", () => {
    const query = bronzeProgressQuery("t", Date.parse("2026-10-06T14:00:00Z"));

    expect(query.statement).toContain(
      "SELECT kinesis_shard_id, unix_millis(max(kinesis_arrival_time))",
    );
    expect(query.statement).toContain("GROUP BY kinesis_shard_id");
    expect(query.parameters).toEqual([
      { name: "since", value: "2026-10-06", type: "DATE" },
      { name: "retention_start", value: "2026-10-06T14:00:00.000Z", type: "TIMESTAMP" },
    ]);
  });
});
