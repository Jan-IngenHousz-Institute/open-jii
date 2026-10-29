import { faker } from "@faker-js/faker";
import * as crypto from "crypto";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type {
  ExperimentProjectTransferWebhookPayload,
  ExperimentProjectTransferWebhookResponse,
} from "@repo/api/domains/experiment/project-transfer-webhook/experiment-project-transfer-webhook.schema";
import type { WebhookErrorResponse } from "@repo/api/domains/user/user.schema";
import { sql } from "@repo/database";

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
  });

  afterEach(() => {
    testApp.afterEach();
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

      const webhookPayload: ExperimentProjectTransferWebhookPayload = {
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
        .post(testApp.resolveOrpcPath(contract.experiments.projectTransfer))
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(webhookPayload);

      expect(response.status).toBe(StatusCodes.CREATED);
      const body = response.body as ExperimentProjectTransferWebhookResponse;
      expect(body.success).toBe(true);
      expect(body.experimentId).toBeDefined();
      expect(body.protocolId).toBeDefined();
      expect(body.macroId).toBeDefined();
      expect(body.macroFilename).toBeDefined();
      expect(body.macroName).toBeDefined();
    });

    it("keeps forged Demo ownership fields out of a signed project import", async () => {
      const importer = await testApp.createTestUser();
      const demo = await testApp.createOrganization("Demo destination", {
        type: "demo",
        visibility: "public",
      });
      await testApp.addOrganizationMember(demo, importer, "owner");
      const forged = {
        organizationId: demo,
        targetOrganizationId: demo,
        type: "demo",
        visibility: "private",
      };
      const payload = {
        ...forged,
        experiment: { name: "Imported experiment", createdBy: importer, ...forged },
        protocol: {
          name: "Imported protocol",
          createdBy: importer,
          code: [{}],
          family: "multispeq",
          ...forged,
        },
        macro: {
          name: "Imported macro",
          createdBy: importer,
          code: btoa("return {}"),
          language: "python",
          ...forged,
        },
      };
      const { signature, timestamp } = signPayload(payload);
      await testApp
        .post(testApp.resolveOrpcPath(contract.experiments.projectTransfer))
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(payload)
        .expect(201);
      const rows = await testApp.database.execute(sql`
        select o.slug, e.organization_id from experiments e join organizations o on o.id = e.organization_id where e.name = 'Imported experiment'
        union all select o.slug, p.organization_id from protocols p join organizations o on o.id = p.organization_id where p.name = 'Imported protocol'
        union all select o.slug, m.organization_id from macros m join organizations o on o.id = m.organization_id where m.name = 'Imported macro'
      `);
      expect(rows).toHaveLength(3);
      for (const row of rows) {
        expect(row.slug).toBe(`personal-${importer}`);
        expect(row.organization_id).not.toBe(demo);
      }
    });

    it("should reject requests without valid API key ID", async () => {
      const testUserId = await testApp.createTestUser({});

      const webhookPayload: ExperimentProjectTransferWebhookPayload = {
        experiment: { name: "E", createdBy: testUserId },
        protocol: { name: "P", code: [{}], family: "multispeq", createdBy: testUserId },
        macro: { name: "M", language: "javascript", code: "Y29kZQ==", createdBy: testUserId },
      };

      await testApp
        .post(testApp.resolveOrpcPath(contract.experiments.projectTransfer))
        .send(webhookPayload)
        .expect(StatusCodes.UNAUTHORIZED)
        .expect(({ body }: { body: WebhookErrorResponse }) => {
          expect(body.message).toContain("Unauthorized");
        });
    });

    it("should reject requests with invalid signature", async () => {
      const testUserId = await testApp.createTestUser({});

      const webhookPayload: ExperimentProjectTransferWebhookPayload = {
        experiment: { name: "E", createdBy: testUserId },
        protocol: { name: "P", code: [{}], family: "multispeq", createdBy: testUserId },
        macro: { name: "M", language: "javascript", code: "Y29kZQ==", createdBy: testUserId },
      };

      const timestamp = Math.floor(Date.now() / 1000).toString();

      await testApp
        .post(testApp.resolveOrpcPath(contract.experiments.projectTransfer))
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
        .post(testApp.resolveOrpcPath(contract.experiments.projectTransfer))
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(payload)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should handle payload with locations", async () => {
      const testUserId = await testApp.createTestUser({});

      const webhookPayload: ExperimentProjectTransferWebhookPayload = {
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
        .post(testApp.resolveOrpcPath(contract.experiments.projectTransfer))
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(webhookPayload);

      expect(response.status).toBe(StatusCodes.CREATED);
      expect((response.body as ExperimentProjectTransferWebhookResponse).success).toBe(true);
    });

    it("should handle payload with questions and create flow", async () => {
      const testUserId = await testApp.createTestUser({});

      const webhookPayload: ExperimentProjectTransferWebhookPayload = {
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
        .post(testApp.resolveOrpcPath(contract.experiments.projectTransfer))
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(webhookPayload);

      expect(response.status).toBe(StatusCodes.CREATED);
      const body = response.body as ExperimentProjectTransferWebhookResponse;
      expect(body.success).toBe(true);
      expect(body.flowId).toBeDefined();
    });
  });
});
