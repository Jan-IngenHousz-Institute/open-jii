import * as crypto from "crypto";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type { DeviceRegistryWebhookResponse } from "@repo/api/schemas/iot.schema";

import { stableStringify } from "../../common/utils/stable-json";
import { TestHarness } from "../../test/test-harness";
import type { SuperTestResponse } from "../../test/test-harness";

describe("DeviceRegistryWebhookController", () => {
  const testApp = TestHarness.App;

  const apiKeyId = process.env.DATABRICKS_WEBHOOK_API_KEY_ID ?? "test-api-key-id";
  const webhookSecret = process.env.DATABRICKS_WEBHOOK_SECRET ?? "test-webhook-secret";

  const sign = (body: object) => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = `${timestamp}:${stableStringify(body)}`;
    const signature = crypto.createHmac("sha256", webhookSecret).update(message).digest("hex");
    return { timestamp, signature };
  };

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

  describe("handleGetDeviceRegistry", () => {
    it("resolves thing names to their registry rows", async () => {
      const userId = await testApp.createTestUser({ email: "owner@example.com", name: "Owner" });
      const device = await testApp.createIotDevice({
        createdBy: userId,
        thingName: "ambyte_AA11",
        serialNumber: "AA:11",
        deviceType: "ambyte",
        status: "active",
      });

      const body = { thingNames: ["ambyte_AA11", "ambyte_missing"] };
      const { timestamp, signature } = sign(body);

      const response: SuperTestResponse<DeviceRegistryWebhookResponse> = await testApp
        .post(contract.iot.getDeviceRegistry.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(body);

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      // Unknown thing names simply do not resolve (left-join yields nothing).
      expect(response.body.devices).toEqual([
        {
          thingName: "ambyte_AA11",
          id: device.id,
          serialNumber: "AA:11",
          deviceType: "ambyte",
          status: "active",
          createdBy: userId,
        },
      ]);
    });

    it("rejects an unsigned request", async () => {
      await testApp
        .post(contract.iot.getDeviceRegistry.path)
        .send({ thingNames: ["ambyte_AA11"] })
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("rejects an empty batch (min 1)", async () => {
      const body = { thingNames: [] };
      const { timestamp, signature } = sign(body);

      await testApp
        .post(contract.iot.getDeviceRegistry.path)
        .set("x-api-key-id", apiKeyId)
        .set("x-databricks-signature", signature)
        .set("x-databricks-timestamp", timestamp)
        .send(body)
        .expect(StatusCodes.BAD_REQUEST);
    });
  });
});
