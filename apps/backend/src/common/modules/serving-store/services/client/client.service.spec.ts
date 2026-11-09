import { ConfigService } from "@nestjs/config";
import { createServer } from "http";
import type { Server } from "http";

import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { ServingStoreConfigService } from "../config/config.service";
import { ServingStoreClientService } from "./client.service";

const STATEMENT = "SELECT id FROM experiment_measurements(experiment = 'a-value-in-the-read')";

/** Answers every request as the store would, so the real client parses what the store sends. */
describe("ServingStoreClientService", () => {
  let server: Server;
  let url: string;
  let answer: { status: number; body: string };
  let requested: URLSearchParams;
  let client: ServingStoreClientService;

  beforeAll(async () => {
    server = createServer((request, response) => {
      requested = new URL(request.url ?? "/", "http://store").searchParams;
      request.resume();
      request.on("end", () => {
        response.writeHead(answer.status, { "Content-Type": "text/plain" });
        response.end(answer.body);
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
    await client.onModuleDestroy();
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

  it("asks the store to refuse a result past 25 MiB before it sends any of it", async () => {
    answer = { status: 200, body: "" };

    await client.query(STATEMENT);

    expect(requested.get("max_result_bytes")).toBe("26214400");
    expect(requested.get("result_overflow_mode")).toBe("throw");
    expect(requested.get("wait_end_of_query")).toBe("1");
  });

  it("answers a result past the store's limit as a page too large", async () => {
    answer = {
      status: 500,
      body: "Code: 396. DB::Exception: Limit for result exceeded, max bytes: 25.00 MiB, current bytes: 63.38 MiB. (TOO_MANY_ROWS_OR_BYTES) (version 25.8.33.6)",
    };

    const result = await client.query(STATEMENT);

    assertFailure(result);
    expect(result.error.code).toBe("PAGE_TOO_LARGE");
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
