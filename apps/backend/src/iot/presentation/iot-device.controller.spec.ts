import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { FEATURE_FLAGS } from "@repo/analytics";
import { contract } from "@repo/api/contract";
import type { IotDevice, IotDeviceList } from "@repo/api/domains/iot/iot.schema";

import { AuthorizationService } from "../../authorization/authorization.service";
import { AnalyticsAdapter } from "../../common/modules/analytics/analytics.adapter";
import { AwsAdapter } from "../../common/modules/aws/aws.adapter";
import { AppError, failure, success } from "../../common/utils/fp-utils";
import type { MockAnalyticsAdapter } from "../../test/mocks/adapters/analytics.adapter.mock";
import { TestHarness } from "../../test/test-harness";
import type { SuperTestResponse } from "../../test/test-harness";
import { ListIotDevicesUseCase } from "../application/use-cases/list-iot-devices/list-iot-devices";

const RETURNED_THING = {
  thingName: "ambyte_TEST-SERIAL",
  thingArn: "arn:aws:iot:eu-central-1:000000000000:thing/ambyte_TEST-SERIAL",
};

describe("IotDeviceController", () => {
  const testApp = TestHarness.App;
  let userId: string;
  let awsAdapter: AwsAdapter;
  let analyticsAdapter: MockAnalyticsAdapter;

  const registerBody = { serialNumber: "AA:BB:CC:DD:EE:FF", name: "Sensor", deviceType: "ambyte" };

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    awsAdapter = testApp.module.get(AwsAdapter);
    analyticsAdapter = testApp.module.get(AnalyticsAdapter);
    analyticsAdapter.setFlag(FEATURE_FLAGS.IOT_DEVICES, true);
    vi.spyOn(awsAdapter, "createThing").mockResolvedValue(success(RETURNED_THING));
    vi.spyOn(awsAdapter, "deleteThing").mockResolvedValue(success(undefined));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("iot-devices feature flag", () => {
    it("returns 403 on every device endpoint when the flag is disabled", async () => {
      const device = await testApp.createIotDevice({ createdBy: userId });
      analyticsAdapter.setFlag(FEATURE_FLAGS.IOT_DEVICES, false);

      await testApp
        .get(testApp.resolveOrpcPath(contract.iot.listIotDevices))
        .withAuth(userId)
        .expect(StatusCodes.FORBIDDEN);
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.registerIotDevice))
        .withAuth(userId)
        .send(registerBody)
        .expect(StatusCodes.FORBIDDEN);

      const getPath = testApp.resolveOrpcPath(contract.iot.getIotDevice, {
        deviceId: device.id,
      });
      await testApp.get(getPath).withAuth(userId).expect(StatusCodes.FORBIDDEN);
      await testApp.delete(getPath).withAuth(userId).expect(StatusCodes.FORBIDDEN);

      const credentialsPath = testApp.resolveOrpcPath(contract.iot.issueIotCredentials, {
        deviceId: device.id,
      });
      await testApp.post(credentialsPath).withAuth(userId).send({}).expect(StatusCodes.FORBIDDEN);
      await testApp.delete(credentialsPath).withAuth(userId).expect(StatusCodes.FORBIDDEN);

      const rotatePath = testApp.resolveOrpcPath(contract.iot.rotateIotCredentials, {
        deviceId: device.id,
      });
      await testApp.post(rotatePath).withAuth(userId).send({}).expect(StatusCodes.FORBIDDEN);
    });
  });

  describe("registerIotDevice", () => {
    it("registers a device (201)", async () => {
      const response: SuperTestResponse<IotDevice> = await testApp
        .post(testApp.resolveOrpcPath(contract.iot.registerIotDevice))
        .withAuth(userId)
        .send(registerBody)
        .expect(StatusCodes.CREATED);

      expect(response.body.thingName).toBe(RETURNED_THING.thingName);
      expect(response.body.status).toBe("pending");
    });

    it("returns 401 when unauthenticated", async () => {
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.registerIotDevice))
        .withoutAuth()
        .send(registerBody)
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("returns 400 for an invalid body", async () => {
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.registerIotDevice))
        .withAuth(userId)
        .send({ name: "missing required fields" })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("returns 409 for a duplicate serial number", async () => {
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.registerIotDevice))
        .withAuth(userId)
        .send(registerBody)
        .expect(StatusCodes.CREATED);

      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.registerIotDevice))
        .withAuth(userId)
        .send(registerBody)
        .expect(StatusCodes.CONFLICT);
    });
  });

  describe("listIotDevices", () => {
    it("lists the user's devices (200)", async () => {
      await testApp.createIotDevice({ createdBy: userId });

      const response: SuperTestResponse<IotDeviceList> = await testApp
        .get(testApp.resolveOrpcPath(contract.iot.listIotDevices))
        .withAuth(userId)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(1);
    });

    it("returns 401 when unauthenticated", async () => {
      await testApp
        .get(testApp.resolveOrpcPath(contract.iot.listIotDevices))
        .withoutAuth()
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("returns 500 when the list use case fails", async () => {
      vi.spyOn(testApp.module.get(ListIotDevicesUseCase), "execute").mockResolvedValue(
        failure(AppError.internal("db unavailable")),
      );

      await testApp
        .get(testApp.resolveOrpcPath(contract.iot.listIotDevices))
        .withAuth(userId)
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });
  });

  describe("getIotDevice / deleteIotDevice", () => {
    it("gets the user's device (200)", async () => {
      const device = await testApp.createIotDevice({ createdBy: userId });
      const path = testApp.resolveOrpcPath(contract.iot.getIotDevice, { deviceId: device.id });

      const response: SuperTestResponse<IotDevice> = await testApp
        .get(path)
        .withAuth(userId)
        .expect(StatusCodes.OK);

      expect(response.body.id).toBe(device.id);
    });

    it("returns 403 for another user's private device", async () => {
      const otherUser = await testApp.createTestUser({});
      const device = await testApp.createIotDevice({ createdBy: otherUser });
      const path = testApp.resolveOrpcPath(contract.iot.getIotDevice, { deviceId: device.id });

      await testApp.get(path).withAuth(userId).expect(StatusCodes.FORBIDDEN);
    });

    it("deletes the user's device (204)", async () => {
      const device = await testApp.createIotDevice({ createdBy: userId });
      const path = testApp.resolveOrpcPath(contract.iot.deleteIotDevice, { deviceId: device.id });

      await testApp.delete(path).withAuth(userId).expect(StatusCodes.NO_CONTENT);
    });

    it("returns 403 when deleting another user's private device", async () => {
      const otherUser = await testApp.createTestUser({});
      const device = await testApp.createIotDevice({ createdBy: otherUser });
      const path = testApp.resolveOrpcPath(contract.iot.deleteIotDevice, { deviceId: device.id });

      await testApp.delete(path).withAuth(userId).expect(StatusCodes.FORBIDDEN);
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
      const path = testApp.resolveOrpcPath(contract.iot.issueIotCredentials, {
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
      const path = testApp.resolveOrpcPath(contract.iot.revokeIotCredentials, {
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
      const path = testApp.resolveOrpcPath(contract.iot.issueIotCredentials, {
        deviceId: device.id,
      });

      await testApp.post(path).send({}).expect(StatusCodes.UNAUTHORIZED);
    });

    it("rotates credentials for an active device (201)", async () => {
      vi.spyOn(awsAdapter, "createDeviceCertificate").mockResolvedValue(success(CERT));
      vi.spyOn(awsAdapter, "attachThingPrincipal").mockResolvedValue(success(undefined));
      vi.spyOn(awsAdapter, "attachDevicePolicies").mockResolvedValue(success(undefined));
      vi.spyOn(awsAdapter, "setCertificateStatus").mockResolvedValue(success(undefined));
      vi.spyOn(awsAdapter, "detachThingPrincipal").mockResolvedValue(success(undefined));
      const device = await testApp.createIotDevice({
        createdBy: userId,
        status: "active",
        certificateId: "cert-old",
        certificateArn: "arn:aws:iot:eu-central-1:000000000000:cert/cert-old",
      });
      const path = testApp.resolveOrpcPath(contract.iot.rotateIotCredentials, {
        deviceId: device.id,
      });

      const response: SuperTestResponse<typeof CERT> = await testApp
        .post(path)
        .withAuth(userId)
        .send({})
        .expect(StatusCodes.CREATED);

      expect(response.body.certificateId).toBe(CERT.certificateId);
      expect(response.body.privateKey).toBe("KEY");
    });

    it("returns 400 when rotating a device that is not active", async () => {
      const device = await testApp.createIotDevice({ createdBy: userId });
      const path = testApp.resolveOrpcPath(contract.iot.rotateIotCredentials, {
        deviceId: device.id,
      });

      await testApp.post(path).withAuth(userId).send({}).expect(StatusCodes.BAD_REQUEST);
    });

    it("returns 400 when issuing for a device that already has a certificate", async () => {
      const device = await testApp.createIotDevice({
        createdBy: userId,
        status: "active",
        certificateId: "cert-live",
        certificateArn: "arn:aws:iot:eu-central-1:000000000000:cert/cert-live",
      });
      const path = testApp.resolveOrpcPath(contract.iot.issueIotCredentials, {
        deviceId: device.id,
      });

      await testApp.post(path).withAuth(userId).send({}).expect(StatusCodes.BAD_REQUEST);
    });

    it("returns 400 when revoking a device without a certificate", async () => {
      const device = await testApp.createIotDevice({ createdBy: userId });
      const path = testApp.resolveOrpcPath(contract.iot.revokeIotCredentials, {
        deviceId: device.id,
      });

      await testApp.delete(path).withAuth(userId).expect(StatusCodes.BAD_REQUEST);
    });
  });

  describe("authorization", () => {
    // Each guarded route must delegate to AuthorizationService.can() with the
    // resource/action declared by its @CanAccess decorator (device id in the
    // `deviceId` param), and turn a denial into a 403. Mocking can() to deny
    // pins the {resource, action} wiring, so a missing or wrong-action decorator
    // fails here.
    it.each([
      {
        name: "get device",
        action: "read",
        request: (deviceId: string, uid: string) =>
          testApp
            .get(testApp.resolveOrpcPath(contract.iot.getIotDevice, { deviceId }))
            .withAuth(uid),
      },
      {
        name: "delete device",
        action: "manage",
        request: (deviceId: string, uid: string) =>
          testApp
            .delete(testApp.resolveOrpcPath(contract.iot.deleteIotDevice, { deviceId }))
            .withAuth(uid),
      },
      {
        name: "issue credentials",
        action: "manage",
        request: (deviceId: string, uid: string) =>
          testApp
            .post(testApp.resolveOrpcPath(contract.iot.issueIotCredentials, { deviceId }))
            .withAuth(uid)
            .send({}),
      },
      {
        name: "rotate credentials",
        action: "manage",
        request: (deviceId: string, uid: string) =>
          testApp
            .post(testApp.resolveOrpcPath(contract.iot.rotateIotCredentials, { deviceId }))
            .withAuth(uid)
            .send({}),
      },
      {
        name: "revoke credentials",
        action: "manage",
        request: (deviceId: string, uid: string) =>
          testApp
            .delete(testApp.resolveOrpcPath(contract.iot.revokeIotCredentials, { deviceId }))
            .withAuth(uid),
      },
    ])("requires $action access to $name", async ({ action, request }) => {
      const canSpy = vi
        .spyOn(testApp.module.get(AuthorizationService), "can")
        .mockResolvedValue({ allow: false, reason: "forbidden" });
      const deviceId = faker.string.uuid();

      await request(deviceId, userId).expect(StatusCodes.FORBIDDEN);

      expect(canSpy).toHaveBeenCalledWith(userId, {
        resourceType: "device",
        resourceId: deviceId,
        action,
      });
    });

    it("returns 403 when registering a device in an organization the caller is not a member of", async () => {
      const organizationId = faker.string.uuid();
      const isOrgMemberSpy = vi
        .spyOn(testApp.module.get(AuthorizationService), "isOrgMember")
        .mockResolvedValue(false);

      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.registerIotDevice))
        .withAuth(userId)
        .send({ ...registerBody, organizationId })
        .expect(StatusCodes.FORBIDDEN);

      expect(isOrgMemberSpy).toHaveBeenCalledWith(userId, organizationId);
    });
  });
});
