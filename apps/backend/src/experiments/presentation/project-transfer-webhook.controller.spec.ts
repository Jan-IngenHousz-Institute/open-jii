import { faker } from "@faker-js/faker";
import * as crypto from "crypto";
import { StatusCodes } from "http-status-codes";

import type {
  ProjectTransferWebhookPayload,
  ProjectTransferWebhookResponse,
  WebhookErrorResponse,
} from "@repo/api";
import { contract } from "@repo/api";

import { DatabricksAdapter } from "../../common/modules/databricks/databricks.adapter";
import { success } from "../../common/utils/fp-utils";
import { stableStringify } from "../../common/utils/stable-json";
import { TestHarness } from "../../test/test-harness";

describe("ProjectTransferWebhookController", () => {
  const testApp = TestHarness.App;

  const apiKeyId = process.env.DATABRICKS_WEBHOOK_API_KEY_ID ?? "test-api-key-id";
  const webhookSecret = process.env.DATABRICKS_WEBHOOK_SECRET ?? "test-webhook-secret";

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();

    // Mock Databricks upload to succeed by default
    const databricksAdapter = testApp.module.get(DatabricksAdapter);
    vi.spyOn(databricksAdapter, "uploadMacroCode").mockResolvedValue(success({}));
  });

  afterEach(() => {
    testApp.afterEach();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  function signPayload(payload: unknown): { signature: string; timestamp: string } {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const raw = `${timestamp}:${stableStringify(payload)}`;
    const signature = crypto.createHmac("sha256", webhookSecret).update(raw).digest("hex");
    return { signature, timestamp };
  }

  describe("handleProjectTransfer", () => {
    it("should create experiment, protocol, and macro and return 201", async () => {
      const testUserId = await testApp.createTestUser({});

      const webhookPayload: ProjectTransferWebhookPayload = {
        experiment: {
          name: "Transfer Exp",
          createdBy: testUserId,
        },
        protocol: {
          name: "Transfer Proto",
          code: [{ step: "measure" }],
          family: "multispeq",
          createdBy: testUserId,
        },
        macro: {
          name: "Transfer Macro",
          language: "javascript",
          code: "Y29uc29sZS5sb2coJ2hlbGxvJyk=",
          createdBy: testUserId,
        },
      };

      const { signature, timestamp } = signPayload(webhookPayload);

      const response = await testApp
        .post(contract.experiments.projectTransfer.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(webhookPayload);

      expect(response.status).toBe(StatusCodes.CREATED);
      const body = response.body as ProjectTransferWebhookResponse;
      expect(body.success).toBe(true);
      expect(body.experimentId).toBeDefined();
      expect(body.protocolId).toBeDefined();
      expect(body.macroId).toBeDefined();
      expect(body.macroFilename).toBeDefined();
      expect(body.macroName).toBeDefined();
    });

    it("should reject requests without valid API key ID", async () => {
      const testUserId = await testApp.createTestUser({});

      const webhookPayload: ProjectTransferWebhookPayload = {
        experiment: { name: "E", createdBy: testUserId },
        protocol: { name: "P", code: [{}], family: "multispeq", createdBy: testUserId },
        macro: { name: "M", language: "javascript", code: "Y29kZQ==", createdBy: testUserId },
      };

      await testApp
        .post(contract.experiments.projectTransfer.path)
        .send(webhookPayload)
        .expect(StatusCodes.UNAUTHORIZED)
        .expect(({ body }: { body: WebhookErrorResponse }) => {
          expect(body.message).toContain("Unauthorized");
        });
    });

    it("should reject requests with invalid signature", async () => {
      const testUserId = await testApp.createTestUser({});

      const webhookPayload: ProjectTransferWebhookPayload = {
        experiment: { name: "E", createdBy: testUserId },
        protocol: { name: "P", code: [{}], family: "multispeq", createdBy: testUserId },
        macro: { name: "M", language: "javascript", code: "Y29kZQ==", createdBy: testUserId },
      };

      const timestamp = Math.floor(Date.now() / 1000).toString();

      await testApp
        .post(contract.experiments.projectTransfer.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", "invalid_signature")
        .set("x-databricks-timestamp", timestamp)
        .send(webhookPayload)
        .expect(StatusCodes.UNAUTHORIZED)
        .expect(({ body }: { body: WebhookErrorResponse }) => {
          expect(body.message).toContain("Unauthorized");
        });
    });

    it("should reject invalid payload (missing experiment name)", async () => {
      const payload = {
        experiment: { createdBy: faker.string.uuid() },
        protocol: { name: "P", code: [{}], createdBy: faker.string.uuid() },
        macro: { name: "M", code: "Y29kZQ==", createdBy: faker.string.uuid() },
      };

      const { signature, timestamp } = signPayload(payload);

      await testApp
        .post(contract.experiments.projectTransfer.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(payload)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should handle payload with locations", async () => {
      const testUserId = await testApp.createTestUser({});

      const webhookPayload: ProjectTransferWebhookPayload = {
        experiment: {
          name: "Exp With Locations",
          createdBy: testUserId,
          locations: [{ name: "Site A", latitude: 42.36, longitude: -71.06 }],
        },
        protocol: {
          name: "Proto With Loc",
          code: [{ step: "measure" }],
          family: "multispeq",
          createdBy: testUserId,
        },
        macro: {
          name: "Macro With Loc",
          language: "javascript",
          code: "Y29kZQ==",
          createdBy: testUserId,
        },
      };

      const { signature, timestamp } = signPayload(webhookPayload);

      const response = await testApp
        .post(contract.experiments.projectTransfer.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(webhookPayload);

      expect(response.status).toBe(StatusCodes.CREATED);
      expect((response.body as ProjectTransferWebhookResponse).success).toBe(true);
    });

    it("should handle payload with questions and create flow", async () => {
      const testUserId = await testApp.createTestUser({});

      const webhookPayload: ProjectTransferWebhookPayload = {
        experiment: {
          name: "Exp With Questions",
          createdBy: testUserId,
        },
        protocol: {
          name: "Proto With Q",
          code: [{ step: "measure" }],
          family: "multispeq",
          createdBy: testUserId,
        },
        macro: {
          name: "Macro With Q",
          language: "javascript",
          code: "Y29kZQ==",
          createdBy: testUserId,
        },
        questions: [
          { kind: "yes_no", text: "Ready?", required: false },
          { kind: "multi_choice", text: "Pick one", options: ["A", "B"], required: true },
        ],
      };

      const { signature, timestamp } = signPayload(webhookPayload);

      const response = await testApp
        .post(contract.experiments.projectTransfer.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(webhookPayload);

      expect(response.status).toBe(StatusCodes.CREATED);
      const body = response.body as ProjectTransferWebhookResponse;
      expect(body.success).toBe(true);
      expect(body.flowId).toBeDefined();
    });
  });
});
