import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { FEATURE_FLAGS } from "@repo/analytics";
import { contract } from "@repo/api/contract";
import type {
  BulkRegisterIotDevicesResult,
  IotDevice,
  IotDeviceDetail,
  IotDeviceList,
} from "@repo/api/domains/iot/iot.schema";

import { AuthorizationService } from "../../authorization/authorization.service";
import { AnalyticsAdapter } from "../../common/modules/analytics/analytics.adapter";
import { AwsAdapter } from "../../common/modules/aws/aws.adapter";
import { DatabricksAdapter } from "../../common/modules/databricks/databricks.adapter";
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
  let databricksAdapter: DatabricksAdapter;
  let analyticsAdapter: MockAnalyticsAdapter;

  const registerBody = { serialNumber: "AA:BB:CC:DD:EE:FF", name: "Sensor", deviceType: "ambyte" };

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    awsAdapter = testApp.module.get(AwsAdapter);
    databricksAdapter = testApp.module.get(DatabricksAdapter);
    analyticsAdapter = testApp.module.get(AnalyticsAdapter);
    analyticsAdapter.setFlag(FEATURE_FLAGS.IOT_DEVICES, true);
    vi.spyOn(awsAdapter, "createThing").mockResolvedValue(success(RETURNED_THING));
    vi.spyOn(awsAdapter, "deleteThing").mockResolvedValue(success(undefined));
    vi.spyOn(awsAdapter, "listThingPrincipals").mockResolvedValue(success([]));
    vi.spyOn(awsAdapter, "getCognitoIdentityId").mockResolvedValue(
      success("eu-central-1:identity-1"),
    );
    vi.spyOn(awsAdapter, "attachThingPrincipal").mockResolvedValue(success(undefined));
    vi.spyOn(awsAdapter, "searchThingsConnectivity").mockResolvedValue(success(new Map()));
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
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.bulkRegisterIotDevices))
        .withAuth(userId)
        .send({ devices: [{ serialNumber: "S-1" }], deviceType: "ambyte" })
        .expect(StatusCodes.FORBIDDEN);
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.ensureMobileDevice))
        .withAuth(userId)
        .send({ installId: "9f2c1a2e-1111-4111-8111-111111111111" })
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

  describe("bulkRegisterIotDevices", () => {
    const bulkPath = () => testApp.resolveOrpcPath(contract.iot.bulkRegisterIotDevices);

    beforeEach(() => {
      // The batch persists several rows, so each Thing must keep its own name.
      vi.spyOn(awsAdapter, "createThing").mockImplementation((input) =>
        Promise.resolve(
          success({
            thingName: input.thingName,
            thingArn: `arn:aws:iot:eu-central-1:000000000000:thing/${input.thingName}`,
          }),
        ),
      );
    });

    async function bulkRegister(
      body: object,
    ): Promise<SuperTestResponse<BulkRegisterIotDevicesResult>> {
      return testApp.post(bulkPath()).withAuth(userId).send(body).expect(StatusCodes.OK);
    }

    it("registers every serial and reports per-device results", async () => {
      const response = await bulkRegister({
        devices: [{ serialNumber: "S-1" }, { serialNumber: "S-2", name: "Second" }],
        deviceType: "ambyte",
      });

      expect(response.body.devices).toHaveLength(2);
      for (const row of response.body.devices) {
        expect(row.error).toBeNull();
        expect(row.device?.thingName).toBe(`ambyte_${row.serialNumber}`);
      }
      expect(response.body.groupId).toBeNull();
      expect(response.body.groupError).toBeNull();
    });

    it("continues past a duplicate serial and reports it inline", async () => {
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.registerIotDevice))
        .withAuth(userId)
        .send({ serialNumber: "S-1", deviceType: "ambyte" })
        .expect(StatusCodes.CREATED);

      const response = await bulkRegister({
        devices: [{ serialNumber: "S-1" }, { serialNumber: "S-2" }],
        deviceType: "ambyte",
      });

      const [first, second] = response.body.devices;
      expect(first.device).toBeNull();
      expect(first.error).toContain("already registered");
      expect(second.device).not.toBeNull();
      expect(second.error).toBeNull();
    });

    it("creates a group around the batch when asked", async () => {
      const response = await bulkRegister({
        devices: [{ serialNumber: "S-1" }, { serialNumber: "S-2" }],
        deviceType: "ambyte",
        group: { name: "Fresh batch" },
      });

      const groupId = response.body.groupId;
      expect(groupId).not.toBeNull();
      expect(response.body.groupError).toBeNull();

      const members: SuperTestResponse<{ deviceId: string }[]> = await testApp
        .get(
          testApp.resolveOrpcPath(contract.iot.listIotDeviceGroupMembers, {
            groupId: groupId ?? "",
          }),
        )
        .withAuth(userId)
        .expect(StatusCodes.OK);
      expect(members.body).toHaveLength(2);
    });

    it("adds the batch to an existing group", async () => {
      const group: SuperTestResponse<{ id: string }> = await testApp
        .post(testApp.resolveOrpcPath(contract.iot.createIotDeviceGroup))
        .withAuth(userId)
        .send({ name: "Existing" })
        .expect(StatusCodes.CREATED);

      const response = await bulkRegister({
        devices: [{ serialNumber: "S-9" }],
        deviceType: "ambyte",
        group: { groupId: group.body.id },
      });

      expect(response.body.groupId).toBe(group.body.id);
      expect(response.body.groupError).toBeNull();
    });

    it("reports group trouble without failing the registrations", async () => {
      const response = await bulkRegister({
        devices: [{ serialNumber: "S-1" }],
        deviceType: "ambyte",
        group: { groupId: faker.string.uuid() },
      });

      expect(response.body.devices[0].device).not.toBeNull();
      expect(response.body.groupId).toBeNull();
      expect(response.body.groupError).toBe("Device group not found");
    });

    it("rejects duplicate serials within one batch (400)", async () => {
      await testApp
        .post(bulkPath())
        .withAuth(userId)
        .send({
          devices: [{ serialNumber: "S-1" }, { serialNumber: "S-1" }],
          deviceType: "ambyte",
        })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("rejects the mobile family like the single register (400)", async () => {
      await testApp
        .post(bulkPath())
        .withAuth(userId)
        .send({ devices: [{ serialNumber: "S-1" }], deviceType: "mobile" })
        .expect(StatusCodes.BAD_REQUEST);
    });
  });

  describe("ensureMobileDevice", () => {
    const ensureBody = { installId: "9f2c1a2e-1111-4111-8111-111111111111", name: "iPhone 15" };

    it("creates on first call and returns the same active device on the second (200)", async () => {
      const first: SuperTestResponse<IotDevice> = await testApp
        .post(testApp.resolveOrpcPath(contract.iot.ensureMobileDevice))
        .withAuth(userId)
        .send(ensureBody)
        .expect(StatusCodes.OK);

      expect(first.body.deviceType).toBe("mobile");
      expect(first.body.status).toBe("active");
      expect(first.body.serialNumber).toBe(ensureBody.installId);

      const second: SuperTestResponse<IotDevice> = await testApp
        .post(testApp.resolveOrpcPath(contract.iot.ensureMobileDevice))
        .withAuth(userId)
        .send(ensureBody)
        .expect(StatusCodes.OK);

      expect(second.body.id).toBe(first.body.id);
    });

    it("rejects a non-uuid install id (400)", async () => {
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.ensureMobileDevice))
        .withAuth(userId)
        .send({ installId: "not-a-uuid" })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("returns 409 when another user holds the install id", async () => {
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.ensureMobileDevice))
        .withAuth(userId)
        .send(ensureBody)
        .expect(StatusCodes.OK);

      const otherUser = await testApp.createTestUser({ name: "Other" });
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.ensureMobileDevice))
        .withAuth(otherUser)
        .send(ensureBody)
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
    it("gets the user's device (200) with the owner's full capabilities", async () => {
      const device = await testApp.createIotDevice({ createdBy: userId });
      const path = testApp.resolveOrpcPath(contract.iot.getIotDevice, { deviceId: device.id });

      const response: SuperTestResponse<IotDeviceDetail> = await testApp
        .get(path)
        .withAuth(userId)
        .expect(StatusCodes.OK);

      expect(response.body.id).toBe(device.id);
      // The owner of the device's org holds every action through that role, and no
      // grant of their own — so there is nothing for them to leave. `canTransfer`
      // is false even for them: a device's AWS Thing and certificate are
      // provisioned against its organization, so there is no transfer route.
      expect(response.body.capabilities).toEqual({
        canContribute: true,
        canUpdate: true,
        canManage: true,
        canShare: true,
        canLeave: false,
        canTransfer: false,
      });
    });

    it("reports a 'Can view' grantee as read-only, with a grant of their own to leave", async () => {
      const device = await testApp.createIotDevice({ createdBy: userId });
      const viewer = await testApp.createTestUser({});
      await testApp.addResourceGrant({
        resourceType: "device",
        resourceId: device.id,
        granteeType: "user",
        granteeId: viewer,
        role: "viewer",
      });
      const path = testApp.resolveOrpcPath(contract.iot.getIotDevice, { deviceId: device.id });

      const response: SuperTestResponse<IotDeviceDetail> = await testApp
        .get(path)
        .withAuth(viewer)
        .expect(StatusCodes.OK);

      // "Can view" on a device is read and nothing else: no rename, no delete, and
      // no certificate operations, all of which the credential routes gate on
      // `manage`. `canLeave` is what surfaces their own Leave affordance.
      expect(response.body.capabilities).toEqual({
        canContribute: false,
        canUpdate: false,
        canManage: false,
        canShare: false,
        canLeave: true,
        canTransfer: false,
      });
    });

    it("gives a 'Can edit' grantee full control, certificates included", async () => {
      const device = await testApp.createIotDevice({ createdBy: userId });
      const editor = await testApp.createTestUser({});
      await testApp.addResourceAdmin("device", device.id, editor);
      const path = testApp.resolveOrpcPath(contract.iot.getIotDevice, { deviceId: device.id });

      const response: SuperTestResponse<IotDeviceDetail> = await testApp
        .get(path)
        .withAuth(editor)
        .expect(StatusCodes.OK);

      // Deliberate and accepted: "Can edit" on a device confers `manage`, so the
      // grantee can delete the device and issue, rotate or revoke its real AWS
      // certificate on hardware they do not own.
      expect(response.body.capabilities.canManage).toBe(true);
      expect(response.body.capabilities.canShare).toBe(true);
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

  describe("getIotDeviceActivity", () => {
    it("returns the pipeline-computed last data arrival (200)", async () => {
      vi.spyOn(databricksAdapter, "getDeviceLastActivity").mockResolvedValue(
        success({ lastDataAt: "2026-08-13T09:00:00.000Z" }),
      );
      const device = await testApp.createIotDevice({ createdBy: userId });
      const path = testApp.resolveOrpcPath(contract.iot.getIotDeviceActivity, {
        deviceId: device.id,
      });

      const response: SuperTestResponse<{ lastDataAt: string | null }> = await testApp
        .get(path)
        .withAuth(userId)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual({
        lastDataAt: "2026-08-13T09:00:00.000Z",
        pipelineUnavailable: false,
      });
    });

    it("degrades to a null lastDataAt when the warehouse is unavailable (200)", async () => {
      vi.spyOn(databricksAdapter, "getDeviceLastActivity").mockResolvedValue(
        failure(AppError.internal("warehouse down")),
      );
      const device = await testApp.createIotDevice({ createdBy: userId });
      const path = testApp.resolveOrpcPath(contract.iot.getIotDeviceActivity, {
        deviceId: device.id,
      });

      const response: SuperTestResponse<{ lastDataAt: string | null }> = await testApp
        .get(path)
        .withAuth(userId)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual({ lastDataAt: null, pipelineUnavailable: true });
    });

    it("returns 403 for another user's private device", async () => {
      const otherUser = await testApp.createTestUser({});
      const device = await testApp.createIotDevice({ createdBy: otherUser });
      const path = testApp.resolveOrpcPath(contract.iot.getIotDeviceActivity, {
        deviceId: device.id,
      });

      await testApp.get(path).withAuth(userId).expect(StatusCodes.FORBIDDEN);
    });
  });

  describe("getDeviceMonitoring", () => {
    const RANGE = {
      from: "2026-08-13T00:00:00.000Z",
      to: "2026-08-13T12:00:00.000Z",
      bucket: "hour",
    };

    const mockWarehouse = () => {
      vi.spyOn(databricksAdapter, "getDeviceLifecycleEvents").mockResolvedValue(
        success([
          {
            eventType: "connected",
            eventTimestamp: "2026-08-13T01:00:00.000Z",
            disconnectReason: null,
            sessionIdentifier: "s-1",
          },
          {
            eventType: "disconnected",
            eventTimestamp: "2026-08-13T03:00:00.000Z",
            disconnectReason: "CONNECTION_LOST",
            sessionIdentifier: "s-1",
          },
        ]),
      );
      vi.spyOn(databricksAdapter, "getDeviceThroughput").mockResolvedValue(
        success([{ bucketStart: "2026-08-13T01:00:00.000Z", experimentId: null, count: 12 }]),
      );
      vi.spyOn(databricksAdapter, "getDeviceBatterySeries").mockResolvedValue(success([]));
      vi.spyOn(databricksAdapter, "getDevicePayloadBreakdown").mockResolvedValue(success([]));
      vi.spyOn(databricksAdapter, "getDeviceMacroBreakdown").mockResolvedValue(success([]));
      vi.spyOn(databricksAdapter, "getDeviceFirmwareHistory").mockResolvedValue(success([]));
      vi.spyOn(databricksAdapter, "getDeviceRecentMeasurements").mockResolvedValue(success([]));
    };

    it("returns the full dashboard payload for one range (200)", async () => {
      mockWarehouse();
      const device = await testApp.createIotDevice({ createdBy: userId });
      const path = testApp.resolveOrpcPath(contract.iot.getDeviceMonitoring, {
        deviceId: device.id,
      });

      const response: SuperTestResponse<{
        bucket: string;
        sessions: unknown[];
        uptimePercent: number | null;
        truncated: boolean;
      }> = await testApp.get(path).withAuth(userId).query(RANGE).expect(StatusCodes.OK);

      expect(response.body.bucket).toBe("hour");
      expect(response.body.sessions).toHaveLength(1);
      expect(response.body.uptimePercent).not.toBeNull();
      expect(response.body.truncated).toBe(false);
    });

    it("fails loudly when the warehouse is down, the dashboard owns the error state (500)", async () => {
      vi.spyOn(databricksAdapter, "getDeviceLifecycleEvents").mockResolvedValue(
        failure(AppError.internal("warehouse down")),
      );
      vi.spyOn(databricksAdapter, "getDeviceThroughput").mockResolvedValue(success([]));
      vi.spyOn(databricksAdapter, "getDeviceBatterySeries").mockResolvedValue(success([]));
      vi.spyOn(databricksAdapter, "getDevicePayloadBreakdown").mockResolvedValue(success([]));
      vi.spyOn(databricksAdapter, "getDeviceMacroBreakdown").mockResolvedValue(success([]));
      vi.spyOn(databricksAdapter, "getDeviceFirmwareHistory").mockResolvedValue(success([]));
      vi.spyOn(databricksAdapter, "getDeviceRecentMeasurements").mockResolvedValue(success([]));
      const device = await testApp.createIotDevice({ createdBy: userId });
      const path = testApp.resolveOrpcPath(contract.iot.getDeviceMonitoring, {
        deviceId: device.id,
      });

      await testApp
        .get(path)
        .withAuth(userId)
        .query(RANGE)
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    it("rejects a reversed range at the contract (400)", async () => {
      mockWarehouse();
      const device = await testApp.createIotDevice({ createdBy: userId });
      const path = testApp.resolveOrpcPath(contract.iot.getDeviceMonitoring, {
        deviceId: device.id,
      });

      await testApp
        .get(path)
        .withAuth(userId)
        .query({ ...RANGE, from: RANGE.to, to: RANGE.from })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("returns 403 for another user's private device", async () => {
      mockWarehouse();
      const otherUser = await testApp.createTestUser({});
      const device = await testApp.createIotDevice({ createdBy: otherUser });
      const path = testApp.resolveOrpcPath(contract.iot.getDeviceMonitoring, {
        deviceId: device.id,
      });

      await testApp.get(path).withAuth(userId).query(RANGE).expect(StatusCodes.FORBIDDEN);
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
        .mockResolvedValue({ allow: false, reason: "forbidden", organizationId: null });
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
