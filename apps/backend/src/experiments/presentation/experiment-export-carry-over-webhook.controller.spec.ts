import { faker } from "@faker-js/faker";
import * as crypto from "crypto";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type {
  ExperimentExportCarryOverPayload,
  ExperimentExportCarryOverRecord,
} from "@repo/api/domains/experiment/export-carry-over-webhook/experiment-export-carry-over-webhook.schema";
import { experimentExports } from "@repo/database";

import { stableStringify } from "../../common/utils/stable-json";
import { TestHarness } from "../../test/test-harness";

describe("ExperimentExportCarryOverWebhookController", () => {
  const testApp = TestHarness.App;
  const apiKeyId = process.env.DATABRICKS_WEBHOOK_API_KEY_ID ?? "test-api-key-id";
  const webhookSecret = process.env.DATABRICKS_WEBHOOK_SECRET ?? "test-webhook-secret";

  let exporterId: string;
  let experimentId: string;

  function signPayload(payload: unknown): { signature: string; timestamp: string } {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const raw = `${timestamp}:${stableStringify(payload)}`;
    const signature = crypto.createHmac("sha256", webhookSecret).update(raw).digest("hex");
    return { signature, timestamp };
  }

  function post(payload: ExperimentExportCarryOverPayload, signature = signPayload(payload)) {
    return testApp
      .post(testApp.resolveOrpcPath(contract.experiments.carryOverExports))
      .set("x-api-key-id", apiKeyId)
      .set("x-databricks-signature", signature.signature)
      .set("x-databricks-timestamp", signature.timestamp)
      .send(payload);
  }

  function carried(
    overrides: Partial<ExperimentExportCarryOverRecord> = {},
  ): ExperimentExportCarryOverRecord {
    return {
      exportId: faker.string.uuid(),
      experimentId,
      tableName: "raw_data",
      format: "parquet",
      anonymizeContributors: false,
      jobRunId: 200436574855526,
      rowCount: 32_117_212,
      parts: [{ name: "part-00000.snappy.parquet", sizeBytes: 27_457_507_736 }],
      createdBy: exporterId,
      createdAt: "2026-10-19T13:18:50.982Z",
      completedAt: "2026-10-19T13:38:41.696Z",
      ...overrides,
    };
  }

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    exporterId = await testApp.createTestUser({});
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: exporterId,
    });
    experimentId = experiment.id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("records carried-over exports as completed and reports how many", async () => {
    const record = carried();

    const response = await post({ exports: [record] }).expect(StatusCodes.CREATED);

    expect(response.body).toEqual({ success: true, imported: 1 });
    const rows = await testApp.database.select().from(experimentExports);
    expect(rows).toEqual([
      expect.objectContaining({
        id: record.exportId,
        status: "completed",
        totalBytes: 27_457_507_736,
        createdBy: exporterId,
      }),
    ]);
  });

  it("records nothing twice when the notebook sends a batch again", async () => {
    const batch = { exports: [carried()] };

    await post(batch).expect(StatusCodes.CREATED);
    const repeat = await post(batch).expect(StatusCodes.CREATED);

    expect(repeat.body).toEqual({ success: true, imported: 0 });
  });

  it("rejects a request with a wrong signature", async () => {
    const body = { exports: [carried()] };

    await post(body, { ...signPayload(body), signature: "0".repeat(64) }).expect(
      StatusCodes.UNAUTHORIZED,
    );

    expect(await testApp.database.select().from(experimentExports)).toHaveLength(0);
  });

  it("rejects an export without parts", async () => {
    await post({ exports: [carried({ parts: [] })] }).expect(StatusCodes.BAD_REQUEST);
  });
});
