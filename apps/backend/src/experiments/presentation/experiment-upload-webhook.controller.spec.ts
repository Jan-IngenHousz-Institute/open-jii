import { faker } from "@faker-js/faker";
import * as crypto from "crypto";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type { ExperimentUploadWebhookPayload } from "@repo/api/domains/experiment/upload-webhook/experiment-upload-webhook.schema";
import { eq, notifications } from "@repo/database";

import { stableStringify } from "../../common/utils/stable-json";
import { TestHarness } from "../../test/test-harness";

describe("ExperimentUploadWebhookController", () => {
  const testApp = TestHarness.App;
  const apiKeyId = process.env.DATABRICKS_WEBHOOK_API_KEY_ID ?? "test-api-key-id";
  const webhookSecret = process.env.DATABRICKS_WEBHOOK_SECRET ?? "test-webhook-secret";

  let uploaderId: string;
  let experimentId: string;

  const notificationsFor = (userId: string) =>
    testApp.database.select().from(notifications).where(eq(notifications.recipientId, userId));

  function signPayload(payload: unknown): { signature: string; timestamp: string } {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const raw = `${timestamp}:${stableStringify(payload)}`;
    const signature = crypto.createHmac("sha256", webhookSecret).update(raw).digest("hex");
    return { signature, timestamp };
  }

  function post(payload: ExperimentUploadWebhookPayload, signature = signPayload(payload)) {
    return testApp
      .post(testApp.resolveOrpcPath(contract.experiments.uploadOutcome))
      .set("x-api-key-id", apiKeyId)
      .set("x-databricks-signature", signature.signature)
      .set("x-databricks-timestamp", signature.timestamp)
      .send(payload);
  }

  function payload(overrides: Partial<ExperimentUploadWebhookPayload> = {}) {
    return {
      experimentId,
      uploadId: faker.string.uuid(),
      userId: uploaderId,
      outcome: "ready" as const,
      uploadTableName: "Leaf temperatures",
      ...overrides,
    } satisfies ExperimentUploadWebhookPayload;
  }

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    uploaderId = await testApp.createTestUser({});
    const { experiment } = await testApp.createExperiment({
      name: "Drought trial",
      userId: uploaderId,
    });
    experimentId = experiment.id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("tells the uploader their upload is ready to query", async () => {
    await post(payload()).expect(StatusCodes.CREATED);

    const rows = await notificationsFor(uploaderId);
    expect(rows).toEqual([
      expect.objectContaining({
        type: "data_upload_completed",
        actorId: null,
        resourceType: "experiment",
        resourceId: experimentId,
        params: { experimentName: "Drought trial" },
      }),
    ]);
  });

  it("tells the uploader their upload failed, naming the table", async () => {
    await post(payload({ outcome: "failed" })).expect(StatusCodes.CREATED);

    const rows = await notificationsFor(uploaderId);
    expect(rows).toEqual([
      expect.objectContaining({
        type: "data_upload_failed",
        params: { experimentName: "Drought trial", fileName: "Leaf temperatures" },
      }),
    ]);
  });

  it("notifies once when the same outcome arrives twice", async () => {
    const repeated = payload();

    await post(repeated).expect(StatusCodes.CREATED);
    await post(repeated).expect(StatusCodes.CREATED);

    expect(await notificationsFor(uploaderId)).toHaveLength(1);
  });

  it("returns 404 for an experiment that does not exist", async () => {
    await post(payload({ experimentId: faker.string.uuid() })).expect(StatusCodes.NOT_FOUND);

    expect(await notificationsFor(uploaderId)).toHaveLength(0);
  });

  it("rejects a request with a wrong signature", async () => {
    const body = payload();

    await post(body, { ...signPayload(body), signature: "0".repeat(64) }).expect(
      StatusCodes.UNAUTHORIZED,
    );

    expect(await notificationsFor(uploaderId)).toHaveLength(0);
  });
});
