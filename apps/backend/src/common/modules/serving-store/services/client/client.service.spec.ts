import { ConfigService } from "@nestjs/config";
import { once } from "events";
import { createServer } from "http";
import type { Server, ServerResponse } from "http";

import { PAGE_TOO_LARGE_MESSAGE } from "../../../../../experiments/core/models/experiment-data.model";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { ServingStoreConfigService } from "../config/config.service";
import { ServingStoreClientService } from "./client.service";

const STATEMENT = "SELECT id FROM experiment_measurements(experiment = 'a-value-in-the-read')";

/** Answers every request as the store would, so the real client parses what the store sends. */
describe("ServingStoreClientService", () => {
  let server: Server;
  let url: string;
  let answer: { status: number; body: string; lines?: { line: string; count: number } };
  let requested: URLSearchParams;
  let client: ServingStoreClientService;
  // How much of a streamed answer the client took before the connection closed.
  let sent = 0;
  let answered: Promise<void> = Promise.resolve();

  /** Writes the lines as fast as the client reads them, until it has them all or hangs up. */
  async function streamLines(
    response: ServerResponse,
    { line, count }: { line: string; count: number },
    closed: Promise<void>,
  ) {
    sent = 0;
    for (let index = 0; index < count && !response.destroyed; index++) {
      sent += line.length;
      if (!response.write(line)) {
        await Promise.race([once(response, "drain"), closed]);
      }
    }
    response.end();
  }

  beforeAll(async () => {
    server = createServer((request, response) => {
      requested = new URL(request.url ?? "/", "http://store").searchParams;
      request.resume();
      request.on("end", () => {
        response.writeHead(answer.status, { "Content-Type": "text/plain" });
        const lines = answer.lines;
        if (lines === undefined) {
          response.end(answer.body);
          return;
        }
        answered = new Promise((resolve) => response.once("close", resolve));
        void streamLines(response, lines, answered);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("The test store has no port");
    }
    url = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    const config = new ConfigService({
      servingStore: { url, username: "reader", password: "secret" },
    });
    client = new ServingStoreClientService(new ServingStoreConfigService(config));
  });

  afterEach(async () => {
    await client.onApplicationShutdown();
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it("refuses a read without a store", async () => {
    const unconfigured = new ServingStoreClientService(
      new ServingStoreConfigService(new ConfigService({})),
    );

    const result = await unconfigured.query(STATEMENT);

    expect(unconfigured.isConfigured()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("STORE_NOT_CONFIGURED");
  });

  it("returns the rows", async () => {
    answer = {
      status: 200,
      body: ['["1","A1"]', '["2",null]'].map((line) => `${line}\n`).join(""),
    };

    const result = await client.query(STATEMENT);

    assertSuccess(result);
    expect(result.value).toEqual({
      rows: [
        ["1", "A1"],
        ["2", null],
      ],
    });
  });

  it("stops reading a result where the reader stops taking rows, leaving the rest unread", async () => {
    // 40 rows of 1 MiB each; the reader takes 5.
    const line = `${JSON.stringify(["x".repeat(1_048_576)])}\n`;
    answer = { status: 200, body: "", lines: { line, count: 40 } };
    let taken = 0;

    const result = await client.stream(STATEMENT, () => {
      taken += 1;
      return taken < 5;
    });

    assertSuccess(result);
    expect(result.value).toEqual({ complete: false });
    expect(taken).toBe(5);
    await answered;
    expect(sent).toBeLessThan(40 * line.length);
  });

  it("reads every row of a result the reader takes whole, in order", async () => {
    answer = { status: 200, body: '["1","A1"]\n["2","B2"]\n["3",null]\n' };
    const rows: unknown[][] = [];

    const result = await client.stream(STATEMENT, (row) => {
      rows.push(row);
      return true;
    });

    assertSuccess(result);
    expect(result.value).toEqual({ complete: true });
    expect(rows).toEqual([
      ["1", "A1"],
      ["2", "B2"],
      ["3", null],
    ]);
  });

  it("asks the store to refuse a result past 100 MiB, 4 times the page limit, before it sends any of it", async () => {
    answer = { status: 200, body: "" };

    await client.query(STATEMENT);

    expect(requested.get("max_result_bytes")).toBe("104857600");
    expect(requested.get("result_overflow_mode")).toBe("throw");
    expect(requested.get("wait_end_of_query")).toBe("1");
  });

  it("merges each month separately, since copies of a row never span two months", async () => {
    answer = { status: 200, body: "" };

    await client.query(STATEMENT);

    expect(requested.get("do_not_merge_across_partitions_select_final")).toBe("1");
  });

  it("allows a query of 1 MiB, which a sort by thousands of inlined ids needs", async () => {
    answer = { status: 200, body: "" };

    await client.query(STATEMENT);

    expect(requested.get("max_query_size")).toBe("1048576");
  });

  it("reads text as the nearest double, as Spark does", async () => {
    answer = { status: 200, body: "" };

    await client.query(STATEMENT);

    expect(requested.get("precise_float_parsing")).toBe("1");
  });

  it("asks the store to quote a double JSON has no number for, which it would write as null", async () => {
    answer = { status: 200, body: "" };

    await client.query(STATEMENT);

    expect(requested.get("output_format_json_quote_denormals")).toBe("1");
  });

  it("answers a result past the store's guard as a page too large", async () => {
    answer = {
      status: 500,
      body: "Code: 396. DB::Exception: Limit for result exceeded, max bytes: 100.00 MiB, current bytes: 163.38 MiB. (TOO_MANY_ROWS_OR_BYTES) (version 25.8.33.6)",
    };

    const result = await client.query(STATEMENT);

    assertFailure(result);
    expect(result.error.code).toBe("PAGE_TOO_LARGE");
    expect(result.error.message).toBe(PAGE_TOO_LARGE_MESSAGE);
    expect(result.error.statusCode).toBe(400);
  });

  it("answers a failed read without its statement or the values in it", async () => {
    answer = {
      status: 404,
      body: `Code: 47. DB::Exception: Unknown expression identifier 'plot' in scope ${STATEMENT}. (UNKNOWN_IDENTIFIER) (version 25.8.33.6)`,
    };

    const result = await client.query(STATEMENT);

    assertFailure(result);
    expect(result.error.code).toBe("SERVING_STORE_QUERY_FAILED");
    expect(result.error.statusCode).toBe(500);
    expect(result.error.message).not.toContain("a-value-in-the-read");
  });

  it("names a read the store stopped at its time limit", async () => {
    answer = {
      status: 500,
      body: "Code: 159. DB::Exception: Timeout exceeded: elapsed 30.001 seconds, maximum: 30. (TIMEOUT_EXCEEDED) (version 25.8.33.6)",
    };

    const result = await client.query(STATEMENT);

    assertFailure(result);
    expect(result.error.code).toBe("STORE_TIMEOUT");
  });

  it("names a read the store refused for its memory", async () => {
    answer = {
      status: 500,
      body: "Code: 241. DB::Exception: Memory limit (for query) exceeded: would use 2.00 GiB, maximum: 2.00 GiB. (MEMORY_LIMIT_EXCEEDED) (version 25.8.33.6)",
    };

    const result = await client.query(STATEMENT);

    assertFailure(result);
    expect(result.error.code).toBe("STORE_MEMORY_LIMIT");
  });
});
