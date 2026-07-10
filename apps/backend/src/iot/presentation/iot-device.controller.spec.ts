import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type { IotDevice, IotDeviceList } from "@repo/api/schemas/iot.schema";

import { AwsAdapter } from "../../common/modules/aws/aws.adapter";
import { success } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import type { SuperTestResponse } from "../../test/test-harness";

const RETURNED_THING = {
  thingName: "ambyte_TEST-SERIAL",
  thingArn: "arn:aws:iot:eu-central-1:000000000000:thing/ambyte_TEST-SERIAL",
};

describe("IotDeviceController", () => {
  const testApp = TestHarness.App;
  let userId: string;
  let awsAdapter: AwsAdapter;

  const registerBody = { serialNumber: "AA:BB:CC:DD:EE:FF", name: "Sensor", deviceType: "ambyte" };

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    awsAdapter = testApp.module.get(AwsAdapter);
    vi.spyOn(awsAdapter, "createThing").mockResolvedValue(success(RETURNED_THING));
    vi.spyOn(awsAdapter, "deleteThing").mockResolvedValue(success(undefined));
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("registerIotDevice", () => {
    it("registers a device (201)", async () => {
      const response: SuperTestResponse<IotDevice> = await testApp
        .post(contract.iot.registerIotDevice.path)
        .withAuth(userId)
        .send(registerBody)
        .expect(StatusCodes.CREATED);

      expect(response.body.thingName).toBe(RETURNED_THING.thingName);
      expect(response.body.status).toBe("pending");
    });

    it("returns 401 when unauthenticated", async () => {
      await testApp
        .post(contract.iot.registerIotDevice.path)
        .withoutAuth()
        .send(registerBody)
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("returns 400 for an invalid body", async () => {
      await testApp
        .post(contract.iot.registerIotDevice.path)
        .withAuth(userId)
        .send({ name: "missing required fields" })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("returns 409 for a duplicate serial number", async () => {
      await testApp
        .post(contract.iot.registerIotDevice.path)
        .withAuth(userId)
        .send(registerBody)
        .expect(StatusCodes.CREATED);

      await testApp
        .post(contract.iot.registerIotDevice.path)
        .withAuth(userId)
        .send(registerBody)
        .expect(StatusCodes.CONFLICT);
    });
  });

  describe("listIotDevices", () => {
    it("lists the user's devices (200)", async () => {
      await testApp.createIotDevice({ createdBy: userId });

      const response: SuperTestResponse<IotDeviceList> = await testApp
        .get(contract.iot.listIotDevices.path)
        .withAuth(userId)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(1);
    });

    it("returns 401 when unauthenticated", async () => {
      await testApp
        .get(contract.iot.listIotDevices.path)
        .withoutAuth()
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("getIotDevice / deleteIotDevice", () => {
    it("gets the user's device (200)", async () => {
      const device = await testApp.createIotDevice({ createdBy: userId });
      const path = testApp.resolvePath(contract.iot.getIotDevice.path, { deviceId: device.id });

      const response: SuperTestResponse<IotDevice> = await testApp
        .get(path)
        .withAuth(userId)
        .expect(StatusCodes.OK);

      expect(response.body.id).toBe(device.id);
    });

    it("returns 404 for another user's device", async () => {
      const otherUser = await testApp.createTestUser({});
      const device = await testApp.createIotDevice({ createdBy: otherUser });
      const path = testApp.resolvePath(contract.iot.getIotDevice.path, { deviceId: device.id });

      await testApp.get(path).withAuth(userId).expect(StatusCodes.NOT_FOUND);
    });

    it("deletes the user's device (204)", async () => {
      const device = await testApp.createIotDevice({ createdBy: userId });
      const path = testApp.resolvePath(contract.iot.deleteIotDevice.path, { deviceId: device.id });

      await testApp.delete(path).withAuth(userId).expect(StatusCodes.NO_CONTENT);
    });

    it("returns 404 when deleting another user's device", async () => {
      const otherUser = await testApp.createTestUser({});
      const device = await testApp.createIotDevice({ createdBy: otherUser });
      const path = testApp.resolvePath(contract.iot.deleteIotDevice.path, { deviceId: device.id });

      await testApp.delete(path).withAuth(userId).expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("credential endpoints", () => {
    const CERT = {
      certificateId: "cert-1",
      certificateArn: "arn:aws:iot:eu-central-1:000000000000:cert/cert-1",
      certificatePem: "PEM",
      publicKey: "PUB",
      privateKey: "KEY",
    };

    it("issues credentials for a pending device (201)", async () => {
      vi.spyOn(awsAdapter, "createDeviceCertificate").mockResolvedValue(success(CERT));
      vi.spyOn(awsAdapter, "attachThingPrincipal").mockResolvedValue(success(undefined));
      vi.spyOn(awsAdapter, "attachDevicePolicies").mockResolvedValue(success(undefined));
      const device = await testApp.createIotDevice({ createdBy: userId });
      const path = testApp.resolvePath(contract.iot.issueIotCredentials.path, {
        deviceId: device.id,
      });

      const response: SuperTestResponse<typeof CERT> = await testApp
        .post(path)
        .withAuth(userId)
        .send({})
        .expect(StatusCodes.CREATED);

      expect(response.body.privateKey).toBe("KEY");
      expect(response.body.certificatePem).toBe("PEM");
    });

    it("revokes credentials for an active device (200)", async () => {
      vi.spyOn(awsAdapter, "setCertificateStatus").mockResolvedValue(success(undefined));
      vi.spyOn(awsAdapter, "detachThingPrincipal").mockResolvedValue(success(undefined));
      const device = await testApp.createIotDevice({
        createdBy: userId,
        status: "active",
        certificateId: "cert-1",
        certificateArn: "arn:aws:iot:eu-central-1:000000000000:cert/cert-1",
      });
      const path = testApp.resolvePath(contract.iot.revokeIotCredentials.path, {
        deviceId: device.id,
      });

      const response: SuperTestResponse<IotDevice> = await testApp
        .delete(path)
        .withAuth(userId)
        .expect(StatusCodes.OK);

      expect(response.body.status).toBe("revoked");
    });

    it("returns 401 when unauthenticated", async () => {
      const device = await testApp.createIotDevice({ createdBy: userId });
      const path = testApp.resolvePath(contract.iot.issueIotCredentials.path, {
        deviceId: device.id,
      });

      await testApp.post(path).send({}).expect(StatusCodes.UNAUTHORIZED);
    });
  });
});
