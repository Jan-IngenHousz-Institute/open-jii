import { faker } from "@faker-js/faker";
import * as crypto from "crypto";
import { StatusCodes } from "http-status-codes";

import type { DatabricksWebhookPayload, WebhookErrorResponse } from "@repo/api";
import { contract } from "@repo/api";

import { assertSuccess } from "../../common/utils/fp-utils";
import { stableStringify } from "../../common/utils/stable-json";
import { TestHarness } from "../../test/test-harness";
import { ExperimentRepository } from "../core/repositories/experiment.repository";

describe("DatabricksWebhookController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let experimentRepository: ExperimentRepository;

  const apiKeyId = process.env.DATABRICKS_WEBHOOK_API_KEY_ID ?? "test-api-key-id";
  const webhookSecret = process.env.DATABRICKS_WEBHOOK_SECRET ?? "test-webhook-secret";

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    experimentRepository = testApp.module.get(ExperimentRepository);

    // Reset any mocks before each test
    jest.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("handleWorkflowStatus", () => {
    it("should process SUCCES status and return success response", async () => {
      // Create an experiment with provisioning status
      const { experiment } = await testApp.createExperiment({
        name: "Databricks Webhook Test",
        status: "provisioning",
        userId: testUserId,
      });

      // Define webhook payload
      const webhookPayload: DatabricksWebhookPayload = {
        experimentId: experiment.id,
        status: "SUCCESS",
        jobRunId: faker.string.numeric(15),
        taskRunId: faker.string.numeric(15),
        timestamp: new Date().toISOString(),
      };

      // Get current timestamp
      const timestamp = Math.floor(Date.now() / 1000).toString();

      // Create signature
      const payload = `${timestamp}:${stableStringify(webhookPayload)}`;
      const signature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

      // Make the API request with the required headers
      const response = await testApp
        .post(contract.webhooks.updateProvisioningStatus.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(webhookPayload);

      // Verify response
      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body).toEqual({
        success: true,
        message: "Experiment status updated to active",
      });

      // Verify the experiment status was updated
      const experimentResult = await experimentRepository.findOne(experiment.id);
      assertSuccess(experimentResult);
      expect(experimentResult.value).toMatchObject({
        id: experiment.id,
        status: "active",
      });
    });

    it("should process FAILURE status and return success response", async () => {
      // Create an experiment with provisioning status
      const { experiment } = await testApp.createExperiment({
        name: "Databricks Webhook Test - Failure",
        status: "provisioning",
        userId: testUserId,
      });

      // Define webhook payload
      const webhookPayload: DatabricksWebhookPayload = {
        experimentId: experiment.id,
        status: "FAILURE",
        jobRunId: faker.string.numeric(15),
        taskRunId: faker.string.numeric(15),
        timestamp: new Date().toISOString(),
      };

      // Get current timestamp and create signature
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = `${timestamp}:${stableStringify(webhookPayload)}`;
      const signature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

      // Make the API request with the required headers
      const response = await testApp
        .post(contract.webhooks.updateProvisioningStatus.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(webhookPayload);

      // Verify response
      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body).toEqual({
        success: true,
        message: "Experiment status updated to provisioning_failed",
      });

      // Verify the experiment status was updated
      const experimentResult = await experimentRepository.findOne(experiment.id);
      assertSuccess(experimentResult);
      expect(experimentResult.value).toMatchObject({
        id: experiment.id,
        status: "provisioning_failed",
      });
    });

    it("should reject non-terminal status with bad request", async () => {
      // Create an experiment with provisioning status
      const { experiment } = await testApp.createExperiment({
        name: "Databricks Webhook Test - Running",
        status: "provisioning",
        userId: testUserId,
      });

      // Define webhook payload with non-terminal status
      const webhookPayload: DatabricksWebhookPayload = {
        experimentId: experiment.id,
        status: "RUNNING",
        jobRunId: faker.string.numeric(15),
        taskRunId: faker.string.numeric(15),
        timestamp: new Date().toISOString(),
      };

      // Get current timestamp and create signature
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = `${timestamp}:${stableStringify(webhookPayload)}`;
      const signature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

      // Act & Assert
      await testApp
        .post(contract.webhooks.updateProvisioningStatus.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(webhookPayload)
        .expect(StatusCodes.BAD_REQUEST)
        .expect(({ body }: { body: WebhookErrorResponse }) => {
          expect(body.message).toContain(
            "Non-terminal status 'RUNNING' does not require a state change.",
          );
        });

      // Verify the experiment status was not updated
      const experimentResult = await experimentRepository.findOne(experiment.id);
      assertSuccess(experimentResult);
      expect(experimentResult.value).toMatchObject({
        id: experiment.id,
        status: "provisioning", // Status should remain unchanged
      });
    });

    it("should handle non-existent experiment", async () => {
      // Define webhook payload with non-existent experiment ID
      const webhookPayload: DatabricksWebhookPayload = {
        experimentId: faker.string.uuid(),
        status: "SUCCESS",
        jobRunId: faker.string.numeric(15),
        taskRunId: faker.string.numeric(15),
        timestamp: new Date().toISOString(),
      };

      // Get current timestamp and create signature
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = `${timestamp}:${stableStringify(webhookPayload)}`;
      const signature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

      // Act & Assert
      await testApp
        .post(contract.webhooks.updateProvisioningStatus.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(webhookPayload)
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }: { body: WebhookErrorResponse }) => {
          expect(body.message).toContain(
            `Experiment with ID ${webhookPayload.experimentId} not found`,
          );
        });
    });

    it("should reject requests without valid API key ID", async () => {
      // Define webhook payload
      const webhookPayload: DatabricksWebhookPayload = {
        experimentId: faker.string.uuid(),
        status: "SUCCESS",
        jobRunId: faker.string.numeric(15),
        taskRunId: faker.string.numeric(15),
        timestamp: new Date().toISOString(),
      };

      // Make the API request without required headers
      await testApp
        .post(contract.webhooks.updateProvisioningStatus.path)
        .send(webhookPayload)
        .expect(StatusCodes.UNAUTHORIZED)
        .expect(({ body }: { body: WebhookErrorResponse }) => {
          expect(body.message).toContain("Missing API key ID");
        });
    });
  });
});
