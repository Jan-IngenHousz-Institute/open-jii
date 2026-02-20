import { faker } from "@faker-js/faker";
import * as crypto from "crypto";
import { StatusCodes } from "http-status-codes";

import type {
  MacroBatchExecutionResponse,
  MacroBatchExecutionWireBody,
  MacroBatchWebhookErrorResponse,
} from "@repo/api";
import { contract } from "@repo/api";

import { success, failure, AppError } from "../../common/utils/fp-utils";
import { stableStringify } from "../../common/utils/stable-json";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";
import { ExecuteMacroBatchUseCase } from "../application/use-cases/execute-macro-batch/execute-macro-batch";

describe("MacroWebhookController", () => {
  const testApp = TestHarness.App;
  let executeMacroBatchUseCase: ExecuteMacroBatchUseCase;

  const apiKeyId = process.env.DATABRICKS_WEBHOOK_API_KEY_ID ?? "test-api-key-id";
  const webhookSecret = process.env.DATABRICKS_WEBHOOK_SECRET ?? "test-webhook-secret";

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    executeMacroBatchUseCase = testApp.module.get(ExecuteMacroBatchUseCase);

    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  /**
   * Helper to sign a webhook payload with HMAC, mirroring HmacGuard expectations.
   */
  function signRequest(body: unknown): {
    signature: string;
    timestamp: string;
  } {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = `${timestamp}:${stableStringify(body)}`;
    const signature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");
    return { signature, timestamp };
  }

  describe("handleExecuteMacroBatch", () => {
    it("should return 200 with batch results on success", async () => {
      const macroId = faker.string.uuid();
      const items = [
        { id: "item-1", macro_id: macroId, data: { trace: [1, 2, 3] } },
        { id: "item-2", macro_id: macroId, data: { trace: [4, 5, 6] } },
      ];
      const requestBody: MacroBatchExecutionWireBody = {
        items: JSON.stringify(items),
        timeout: 10,
      };

      vi.spyOn(executeMacroBatchUseCase, "execute").mockResolvedValue(
        success({
          results: [
            { id: "item-1", macro_id: macroId, success: true, output: { processed: true } },
            { id: "item-2", macro_id: macroId, success: true, output: { processed: true } },
          ],
        }),
      );

      const { signature, timestamp } = signRequest(requestBody);

      const response = await testApp
        .post(contract.macros.executeMacroBatch.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(requestBody);

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body).toMatchObject({
        results: expect.arrayContaining([
          expect.objectContaining({ id: "item-1", success: true }),
          expect.objectContaining({ id: "item-2", success: true }),
        ]) as unknown,
      });
    });

    it("should return 200 with partial failures when some items fail", async () => {
      const macroId = faker.string.uuid();
      const requestBody: MacroBatchExecutionWireBody = {
        items: JSON.stringify([{ id: "item-1", macro_id: macroId, data: {} }]),
        timeout: 10,
      };

      vi.spyOn(executeMacroBatchUseCase, "execute").mockResolvedValue(
        success({
          results: [{ id: "item-1", macro_id: macroId, success: false, error: "Macro not found" }],
          errors: [`Macro not found: ${macroId}`],
        }),
      );

      const { signature, timestamp } = signRequest(requestBody);

      const response = await testApp
        .post(contract.macros.executeMacroBatch.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(requestBody);

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body).toMatchObject({
        results: [expect.objectContaining({ id: "item-1", success: false }) as unknown],
        errors: expect.arrayContaining([expect.stringContaining("Macro not found")]) as unknown,
      });
    });

    it("should return 500 when use case returns a failure", async () => {
      const requestBody: MacroBatchExecutionWireBody = {
        items: JSON.stringify([{ id: "item-1", macro_id: faker.string.uuid(), data: {} }]),
        timeout: 10,
      };

      vi.spyOn(executeMacroBatchUseCase, "execute").mockResolvedValue(
        failure(AppError.internal("Database error")),
      );

      const { signature, timestamp } = signRequest(requestBody);

      await testApp
        .post(contract.macros.executeMacroBatch.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(requestBody)
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    it("should return 400 for invalid request body", async () => {
      const invalidBody = {
        // Missing required 'items' field
        timeout: 10,
      };

      const { signature, timestamp } = signRequest(invalidBody);

      await testApp
        .post(contract.macros.executeMacroBatch.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(invalidBody)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 400 when items array is empty", async () => {
      const invalidBody: MacroBatchExecutionWireBody = {
        items: JSON.stringify([]),
        timeout: 10,
      };

      const { signature, timestamp } = signRequest(invalidBody);

      await testApp
        .post(contract.macros.executeMacroBatch.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(invalidBody)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should accept items with stringified data fields (double serialisation)", async () => {
      const macroId = faker.string.uuid();
      const items = [
        { id: "item-1", macro_id: macroId, data: JSON.stringify({ trace: [10, 20] }) },
      ];

      const requestBody: MacroBatchExecutionWireBody = {
        items: JSON.stringify(items),
        timeout: 5,
      };

      vi.spyOn(executeMacroBatchUseCase, "execute").mockResolvedValue(
        success({
          results: [{ id: "item-1", macro_id: macroId, success: true, output: { mean: 15 } }],
        }),
      );

      const { signature, timestamp } = signRequest(requestBody);

      const response: SuperTestResponse<MacroBatchExecutionResponse> = await testApp
        .post(contract.macros.executeMacroBatch.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(requestBody);

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.results[0]).toMatchObject({ id: "item-1", success: true });
    });
  });

  describe("HMAC authentication", () => {
    it("should reject requests without API key ID", async () => {
      const requestBody: MacroBatchExecutionWireBody = {
        items: JSON.stringify([{ id: "item-1", macro_id: faker.string.uuid(), data: {} }]),
        timeout: 10,
      };

      await testApp
        .post(contract.macros.executeMacroBatch.path)
        .send(requestBody)
        .expect(StatusCodes.UNAUTHORIZED)
        .expect(({ body }: { body: MacroBatchWebhookErrorResponse }) => {
          expect(body.message).toContain("Unauthorized");
        });
    });

    it("should reject requests with invalid signature", async () => {
      const requestBody: MacroBatchExecutionWireBody = {
        items: JSON.stringify([{ id: "item-1", macro_id: faker.string.uuid(), data: {} }]),
        timeout: 10,
      };

      const timestamp = Math.floor(Date.now() / 1000).toString();

      await testApp
        .post(contract.macros.executeMacroBatch.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", "invalid_signature")
        .set("x-databricks-timestamp", timestamp)
        .send(requestBody)
        .expect(StatusCodes.UNAUTHORIZED)
        .expect(({ body }: { body: MacroBatchWebhookErrorResponse }) => {
          expect(body.message).toContain("Unauthorized");
        });
    });

    it("should reject requests with missing timestamp", async () => {
      const requestBody: MacroBatchExecutionWireBody = {
        items: JSON.stringify([{ id: "item-1", macro_id: faker.string.uuid(), data: {} }]),
        timeout: 10,
      };

      await testApp
        .post(contract.macros.executeMacroBatch.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", "some-sig")
        .send(requestBody)
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should reject requests with expired timestamp", async () => {
      const requestBody: MacroBatchExecutionWireBody = {
        items: JSON.stringify([{ id: "item-1", macro_id: faker.string.uuid(), data: {} }]),
        timeout: 10,
      };

      // 10 minutes ago — beyond the 5-minute window
      const staleTimestamp = (Math.floor(Date.now() / 1000) - 600).toString();
      const payload = `${staleTimestamp}:${stableStringify(requestBody)}`;
      const signature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

      await testApp
        .post(contract.macros.executeMacroBatch.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", staleTimestamp)
        .send(requestBody)
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });
});
