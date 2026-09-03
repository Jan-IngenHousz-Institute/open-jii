import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { FEATURE_FLAGS } from "@repo/analytics";
import { contract } from "@repo/api/contract";
import type {
  IotDeviceGroup,
  IotDeviceGroupDetail,
  IotDeviceGroupListItem,
  IotDeviceGroupMember,
} from "@repo/api/domains/iot/device-group/iot-device-group.schema";

import { AnalyticsAdapter } from "../../common/modules/analytics/analytics.adapter";
import { AwsAdapter } from "../../common/modules/aws/aws.adapter";
import { DatabricksAdapter } from "../../common/modules/databricks/databricks.adapter";
import { AppError, failure, success } from "../../common/utils/fp-utils";
import type { MockAnalyticsAdapter } from "../../test/mocks/adapters/analytics.adapter.mock";
import { TestHarness } from "../../test/test-harness";
import type { SuperTestResponse } from "../../test/test-harness";
import { GetIotDeviceGroupMonitoringUseCase } from "../application/use-cases/get-iot-device-group-monitoring/get-iot-device-group-monitoring";
import { IssueIotDeviceGroupCredentialsUseCase } from "../application/use-cases/issue-iot-device-group-credentials/issue-iot-device-group-credentials";
import { OnboardIotDeviceGroupUseCase } from "../application/use-cases/onboard-iot-device-group/onboard-iot-device-group";
import { RevokeIotDeviceGroupCredentialsUseCase } from "../application/use-cases/revoke-iot-device-group-credentials/revoke-iot-device-group-credentials";
import { RotateIotDeviceGroupCredentialsUseCase } from "../application/use-cases/rotate-iot-device-group-credentials/rotate-iot-device-group-credentials";

const MONITORING_RANGE = {
  from: "2026-08-17T00:00:00.000Z",
  to: "2026-08-18T00:00:00.000Z",
  bucket: "hour",
};

describe("IotDeviceGroupController", () => {
  const testApp = TestHarness.App;
  let userId: string;
  let analyticsAdapter: MockAnalyticsAdapter;

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    analyticsAdapter = testApp.module.get(AnalyticsAdapter);
    analyticsAdapter.setFlag(FEATURE_FLAGS.IOT_DEVICES, true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function createGroup(name = "Field campaign"): Promise<IotDeviceGroup> {
    const response: SuperTestResponse<IotDeviceGroup> = await testApp
      .post(testApp.resolveOrpcPath(contract.iot.createIotDeviceGroup))
      .withAuth(userId)
      .send({ name })
      .expect(StatusCodes.CREATED);
    return response.body;
  }

  describe("iot-devices feature flag", () => {
    it("returns 403 on every group endpoint when the flag is disabled", async () => {
      const group = await createGroup();
      analyticsAdapter.setFlag(FEATURE_FLAGS.IOT_DEVICES, false);

      await testApp
        .get(testApp.resolveOrpcPath(contract.iot.listIotDeviceGroups))
        .withAuth(userId)
        .expect(StatusCodes.FORBIDDEN);
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.createIotDeviceGroup))
        .withAuth(userId)
        .send({ name: "x" })
        .expect(StatusCodes.FORBIDDEN);

      const groupPath = testApp.resolveOrpcPath(contract.iot.getIotDeviceGroup, {
        groupId: group.id,
      });
      await testApp.get(groupPath).withAuth(userId).expect(StatusCodes.FORBIDDEN);
      await testApp
        .patch(groupPath)
        .withAuth(userId)
        .send({ name: "y" })
        .expect(StatusCodes.FORBIDDEN);
      await testApp.delete(groupPath).withAuth(userId).expect(StatusCodes.FORBIDDEN);

      const membersPath = testApp.resolveOrpcPath(contract.iot.listIotDeviceGroupMembers, {
        groupId: group.id,
      });
      await testApp.get(membersPath).withAuth(userId).expect(StatusCodes.FORBIDDEN);
      await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.onboardIotDeviceGroup, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .send({ experimentIds: [] })
        .expect(StatusCodes.FORBIDDEN);
      await testApp
        .get(
          testApp.resolveOrpcPath(contract.iot.getIotDeviceGroupMonitoring, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .query(MONITORING_RANGE)
        .expect(StatusCodes.FORBIDDEN);
      await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.issueIotDeviceGroupCredentials, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .send({})
        .expect(StatusCodes.FORBIDDEN);
      await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.rotateIotDeviceGroupCredentials, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .send({})
        .expect(StatusCodes.FORBIDDEN);
      await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.revokeIotDeviceGroupCredentials, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .send({})
        .expect(StatusCodes.FORBIDDEN);
      await testApp
        .post(membersPath)
        .withAuth(userId)
        .send({ deviceIds: ["11111111-1111-4111-8111-111111111111"] })
        .expect(StatusCodes.FORBIDDEN);
    });
  });

  describe("createIotDeviceGroup", () => {
    it("creates a private group owned by the caller (201)", async () => {
      const group = await createGroup("Greenhouse A");

      expect(group.name).toBe("Greenhouse A");
      expect(group.visibility).toBe("private");
      expect(group.createdBy).toBe(userId);
      expect(group.organizationId).not.toBeNull();
    });

    it("returns 401 when unauthenticated", async () => {
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.createIotDeviceGroup))
        .withoutAuth()
        .send({ name: "x" })
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("listIotDeviceGroups", () => {
    it("lists the caller's groups with member counts", async () => {
      const group = await createGroup();
      const device = await testApp.createIotDevice({ createdBy: userId });
      await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.addIotDeviceGroupMembers, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .send({ deviceIds: [device.id] })
        .expect(StatusCodes.OK);

      const response: SuperTestResponse<IotDeviceGroupListItem[]> = await testApp
        .get(testApp.resolveOrpcPath(contract.iot.listIotDeviceGroups))
        .withAuth(userId)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].memberCount).toBe(1);
    });

    it("does not list another user's group", async () => {
      await createGroup();
      const otherId = await testApp.createTestUser({ name: "Other" });

      const response: SuperTestResponse<IotDeviceGroupListItem[]> = await testApp
        .get(testApp.resolveOrpcPath(contract.iot.listIotDeviceGroups))
        .withAuth(otherId)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(0);
    });
  });

  describe("getIotDeviceGroup", () => {
    it("returns the group with the caller's capabilities (200)", async () => {
      const group = await createGroup();

      const response: SuperTestResponse<IotDeviceGroupDetail> = await testApp
        .get(testApp.resolveOrpcPath(contract.iot.getIotDeviceGroup, { groupId: group.id }))
        .withAuth(userId)
        .expect(StatusCodes.OK);

      expect(response.body.id).toBe(group.id);
      expect(response.body.capabilities.canManage).toBe(true);
    });

    it("returns 403 for another user's private group", async () => {
      const group = await createGroup();
      const otherId = await testApp.createTestUser({ name: "Other" });

      await testApp
        .get(testApp.resolveOrpcPath(contract.iot.getIotDeviceGroup, { groupId: group.id }))
        .withAuth(otherId)
        .expect(StatusCodes.FORBIDDEN);
    });
  });

  describe("updateIotDeviceGroup", () => {
    it("returns 404 for a nonexistent group", async () => {
      await testApp
        .patch(
          testApp.resolveOrpcPath(contract.iot.updateIotDeviceGroup, {
            groupId: faker.string.uuid(),
          }),
        )
        .withAuth(userId)
        .send({ name: "renamed" })
        .expect(StatusCodes.NOT_FOUND);
    });

    it("returns 403 when a non-collaborator renames the group", async () => {
      const group = await createGroup();
      const stranger = await testApp.createTestUser({ name: "Stranger" });

      await testApp
        .patch(testApp.resolveOrpcPath(contract.iot.updateIotDeviceGroup, { groupId: group.id }))
        .withAuth(stranger)
        .send({ name: "renamed" })
        .expect(StatusCodes.FORBIDDEN);
    });

    it("renames the group (200)", async () => {
      const group = await createGroup();

      const response: SuperTestResponse<IotDeviceGroup> = await testApp
        .patch(testApp.resolveOrpcPath(contract.iot.updateIotDeviceGroup, { groupId: group.id }))
        .withAuth(userId)
        .send({ name: "Renamed" })
        .expect(StatusCodes.OK);

      expect(response.body.name).toBe("Renamed");
    });
  });

  describe("deleteIotDeviceGroup", () => {
    it("returns 404 when deleting a nonexistent group", async () => {
      await testApp
        .delete(
          testApp.resolveOrpcPath(contract.iot.deleteIotDeviceGroup, {
            groupId: faker.string.uuid(),
          }),
        )
        .withAuth(userId)
        .expect(StatusCodes.NOT_FOUND);
    });

    it("deletes the group (204)", async () => {
      const group = await createGroup();

      await testApp
        .delete(testApp.resolveOrpcPath(contract.iot.deleteIotDeviceGroup, { groupId: group.id }))
        .withAuth(userId)
        .expect(StatusCodes.NO_CONTENT);

      // Gone means gone: the guard resolves a deleted group to 404, not 403.
      await testApp
        .get(testApp.resolveOrpcPath(contract.iot.getIotDeviceGroup, { groupId: group.id }))
        .withAuth(userId)
        .expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("onboardIotDeviceGroup", () => {
    it("returns a per-device outcome list (200)", async () => {
      const group = await createGroup();
      const device = await testApp.createIotDevice({ createdBy: userId, status: "active" });
      await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.addIotDeviceGroupMembers, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .send({ deviceIds: [device.id] })
        .expect(StatusCodes.OK);
      const awsAdapter = testApp.module.get(AwsAdapter);
      vi.spyOn(awsAdapter, "getIotDataEndpoint").mockResolvedValue(
        success("data.iot.example.amazonaws.com"),
      );

      const response: SuperTestResponse<{
        devices: { deviceId: string; config: { thingName: string } | null; error: string | null }[];
      }> = await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.onboardIotDeviceGroup, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .send({ experimentIds: [] })
        .expect(StatusCodes.OK);

      expect(response.body.devices).toHaveLength(1);
      expect(response.body.devices[0].deviceId).toBe(device.id);
      expect(response.body.devices[0].config?.thingName).toBe(device.thingName);
    });

    it("returns 403 for a viewer without contribute access", async () => {
      const group = await createGroup();
      const stranger = await testApp.createTestUser({ name: "Stranger" });

      await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.onboardIotDeviceGroup, {
            groupId: group.id,
          }),
        )
        .withAuth(stranger)
        .send({ experimentIds: [] })
        .expect(StatusCodes.FORBIDDEN);
    });

    it("maps a use-case failure through the error contract (500)", async () => {
      const group = await createGroup();
      const useCase = testApp.module.get(OnboardIotDeviceGroupUseCase);
      vi.spyOn(useCase, "execute").mockResolvedValue(failure(AppError.internal("boom")));

      await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.onboardIotDeviceGroup, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .send({ experimentIds: [] })
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });
  });

  describe("group credentials", () => {
    const CERT = {
      certificateId: "cert-new",
      certificateArn: "arn:aws:iot:eu-central-1:000000000000:cert/cert-new",
      certificatePem: "PEM",
      publicKey: "PUB",
      privateKey: "KEY",
    };

    async function addMember(groupId: string, deviceId: string) {
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.addIotDeviceGroupMembers, { groupId }))
        .withAuth(userId)
        .send({ deviceIds: [deviceId] })
        .expect(StatusCodes.OK);
    }

    it("issues per-device credentials for the selection (200)", async () => {
      const group = await createGroup();
      const device = await testApp.createIotDevice({ createdBy: userId, status: "pending" });
      await addMember(group.id, device.id);
      const awsAdapter = testApp.module.get(AwsAdapter);
      vi.spyOn(awsAdapter, "createDeviceCertificate").mockResolvedValue(success(CERT));
      vi.spyOn(awsAdapter, "attachThingPrincipal").mockResolvedValue(success(undefined));
      vi.spyOn(awsAdapter, "attachDevicePolicies").mockResolvedValue(success(undefined));

      const response: SuperTestResponse<{
        devices: {
          deviceId: string;
          thingName: string | null;
          credentials: { privateKey: string } | null;
          error: string | null;
        }[];
      }> = await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.issueIotDeviceGroupCredentials, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .send({ deviceIds: [device.id] })
        .expect(StatusCodes.OK);

      expect(response.body.devices).toEqual([
        {
          deviceId: device.id,
          thingName: device.thingName,
          credentials: CERT,
          error: null,
        },
      ]);
    });

    it("revokes the selection with per-device outcomes (200)", async () => {
      const group = await createGroup();
      const device = await testApp.createIotDevice({
        createdBy: userId,
        status: "active",
        certificateId: "cert-old",
        certificateArn: "arn:aws:iot:eu-central-1:000000000000:cert/cert-old",
      });
      await addMember(group.id, device.id);
      const awsAdapter = testApp.module.get(AwsAdapter);
      vi.spyOn(awsAdapter, "setCertificateStatus").mockResolvedValue(success(undefined));
      vi.spyOn(awsAdapter, "detachThingPrincipal").mockResolvedValue(success(undefined));

      const response: SuperTestResponse<{
        devices: { deviceId: string; error: string | null }[];
      }> = await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.revokeIotDeviceGroupCredentials, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .send({})
        .expect(StatusCodes.OK);

      expect(response.body.devices).toEqual([{ deviceId: device.id, error: null }]);
    });

    it("returns 403 for a caller without manage access on the group", async () => {
      const group = await createGroup();
      const stranger = await testApp.createTestUser({ name: "Stranger" });

      await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.issueIotDeviceGroupCredentials, {
            groupId: group.id,
          }),
        )
        .withAuth(stranger)
        .send({})
        .expect(StatusCodes.FORBIDDEN);
      await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.rotateIotDeviceGroupCredentials, {
            groupId: group.id,
          }),
        )
        .withAuth(stranger)
        .send({})
        .expect(StatusCodes.FORBIDDEN);
      await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.revokeIotDeviceGroupCredentials, {
            groupId: group.id,
          }),
        )
        .withAuth(stranger)
        .send({})
        .expect(StatusCodes.FORBIDDEN);
    });

    it("maps use-case failures through the error contract (500)", async () => {
      const group = await createGroup();
      const boom = failure(AppError.internal("boom"));
      vi.spyOn(
        testApp.module.get(IssueIotDeviceGroupCredentialsUseCase),
        "execute",
      ).mockResolvedValue(boom);
      vi.spyOn(
        testApp.module.get(RotateIotDeviceGroupCredentialsUseCase),
        "execute",
      ).mockResolvedValue(boom);
      vi.spyOn(
        testApp.module.get(RevokeIotDeviceGroupCredentialsUseCase),
        "execute",
      ).mockResolvedValue(boom);

      await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.issueIotDeviceGroupCredentials, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .send({})
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
      await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.rotateIotDeviceGroupCredentials, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .send({})
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
      await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.revokeIotDeviceGroupCredentials, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .send({})
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });
  });

  describe("getIotDeviceGroupMonitoring", () => {
    it("returns per-member health facts (200)", async () => {
      const group = await createGroup();
      const device = await testApp.createIotDevice({ createdBy: userId, name: "Gateway" });
      await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.addIotDeviceGroupMembers, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .send({ deviceIds: [device.id] })
        .expect(StatusCodes.OK);
      const awsAdapter = testApp.module.get(AwsAdapter);
      const databricksAdapter = testApp.module.get(DatabricksAdapter);
      vi.spyOn(awsAdapter, "searchThingsConnectivity").mockResolvedValue(
        success(
          new Map([
            [device.thingName, { thingName: device.thingName, connected: true, lastSeenAt: null }],
          ]),
        ),
      );
      vi.spyOn(databricksAdapter, "getDevicesLastActivity").mockResolvedValue(
        success(new Map([[device.thingName, "2026-08-18T10:00:00.000Z"]])),
      );
      vi.spyOn(databricksAdapter, "getDevicesThroughput").mockResolvedValue(
        success([
          { bucketStart: "2026-08-17T10:00:00.000Z", clientId: device.thingName, count: 3 },
        ]),
      );
      vi.spyOn(databricksAdapter, "getDevicesLifecycleEvents").mockResolvedValue(success([]));
      vi.spyOn(databricksAdapter, "getDevicesDataByExperiment").mockResolvedValue(success([]));
      vi.spyOn(databricksAdapter, "getDevicesFirmware").mockResolvedValue(success([]));

      const response: SuperTestResponse<{
        members: { deviceId: string; connectivity: { connected: boolean } | null }[];
        throughput: { deviceId: string | null; count: number }[];
        pipelineUnavailable: boolean;
      }> = await testApp
        .get(
          testApp.resolveOrpcPath(contract.iot.getIotDeviceGroupMonitoring, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .query(MONITORING_RANGE)
        .expect(StatusCodes.OK);

      expect(response.body.pipelineUnavailable).toBe(false);
      expect(response.body.members).toHaveLength(1);
      expect(response.body.members[0].deviceId).toBe(device.id);
      expect(response.body.members[0].connectivity?.connected).toBe(true);
      expect(response.body.throughput).toEqual([
        { bucketStart: "2026-08-17T10:00:00.000Z", deviceId: device.id, count: 3 },
      ]);
    });

    it("accepts a window of exactly 31 days (200)", async () => {
      const group = await createGroup();

      await testApp
        .get(
          testApp.resolveOrpcPath(contract.iot.getIotDeviceGroupMonitoring, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .query({ from: "2026-01-01T00:00:00.000Z", to: "2026-02-01T00:00:00.000Z", bucket: "day" })
        .expect(StatusCodes.OK);
    });

    it("maps a use-case failure through the error contract (500)", async () => {
      const group = await createGroup();
      const useCase = testApp.module.get(GetIotDeviceGroupMonitoringUseCase);
      vi.spyOn(useCase, "execute").mockResolvedValue(failure(AppError.internal("boom")));

      await testApp
        .get(
          testApp.resolveOrpcPath(contract.iot.getIotDeviceGroupMonitoring, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .query(MONITORING_RANGE)
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    it("rejects a window wider than 31 days (400)", async () => {
      const group = await createGroup();

      await testApp
        .get(
          testApp.resolveOrpcPath(contract.iot.getIotDeviceGroupMonitoring, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .query({ from: "2026-01-01T00:00:00.000Z", to: "2026-03-01T00:00:00.000Z", bucket: "day" })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("returns 403 for another user's private group", async () => {
      const group = await createGroup();
      const stranger = await testApp.createTestUser({ name: "Stranger" });

      await testApp
        .get(
          testApp.resolveOrpcPath(contract.iot.getIotDeviceGroupMonitoring, {
            groupId: group.id,
          }),
        )
        .withAuth(stranger)
        .query(MONITORING_RANGE)
        .expect(StatusCodes.FORBIDDEN);
    });
  });

  describe("membership", () => {
    it("adds devices, lists the shallow roster, and removes a member", async () => {
      const group = await createGroup();
      const device = await testApp.createIotDevice({ createdBy: userId, name: null });

      const added: SuperTestResponse<IotDeviceGroupMember[]> = await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.addIotDeviceGroupMembers, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .send({ deviceIds: [device.id] })
        .expect(StatusCodes.OK);

      expect(added.body).toHaveLength(1);
      expect(added.body[0]).toMatchObject({
        deviceId: device.id,
        name: null,
        serialNumber: device.serialNumber,
      });

      await testApp
        .delete(
          testApp.resolveOrpcPath(contract.iot.removeIotDeviceGroupMember, {
            groupId: group.id,
            deviceId: device.id,
          }),
        )
        .withAuth(userId)
        .expect(StatusCodes.NO_CONTENT);

      const roster: SuperTestResponse<IotDeviceGroupMember[]> = await testApp
        .get(
          testApp.resolveOrpcPath(contract.iot.listIotDeviceGroupMembers, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .expect(StatusCodes.OK);
      expect(roster.body).toHaveLength(0);
    });

    it("enriches the roster with fleet-index connectivity, degrading to unknown", async () => {
      const group = await createGroup();
      const device = await testApp.createIotDevice({ createdBy: userId });
      await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.addIotDeviceGroupMembers, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .send({ deviceIds: [device.id] })
        .expect(StatusCodes.OK);
      const rosterPath = testApp.resolveOrpcPath(contract.iot.listIotDeviceGroupMembers, {
        groupId: group.id,
      });
      const awsAdapter = testApp.module.get(AwsAdapter);
      const search = vi
        .spyOn(awsAdapter, "searchThingsConnectivity")
        .mockResolvedValue(
          success(
            new Map([
              [
                device.thingName,
                { thingName: device.thingName, connected: true, lastSeenAt: null },
              ],
            ]),
          ),
        );

      const online: SuperTestResponse<IotDeviceGroupMember[]> = await testApp
        .get(rosterPath)
        .withAuth(userId)
        .expect(StatusCodes.OK);
      expect(online.body[0].connected).toBe(true);

      // A fleet-index failure degrades every row to unknown, never an error.
      search.mockResolvedValue(failure(AppError.internal("index down")));
      const unknown: SuperTestResponse<IotDeviceGroupMember[]> = await testApp
        .get(rosterPath)
        .withAuth(userId)
        .expect(StatusCodes.OK);
      expect(unknown.body[0].connected).toBeNull();
    });

    it("re-adding a member is a no-op, not an error", async () => {
      const group = await createGroup();
      const device = await testApp.createIotDevice({ createdBy: userId });
      const path = testApp.resolveOrpcPath(contract.iot.addIotDeviceGroupMembers, {
        groupId: group.id,
      });

      await testApp
        .post(path)
        .withAuth(userId)
        .send({ deviceIds: [device.id] })
        .expect(200);
      const again: SuperTestResponse<IotDeviceGroupMember[]> = await testApp
        .post(path)
        .withAuth(userId)
        .send({ deviceIds: [device.id] })
        .expect(StatusCodes.OK);

      expect(again.body).toHaveLength(1);
    });

    it("rejects the batch when a device is not manageable by the caller", async () => {
      const group = await createGroup();
      const mine = await testApp.createIotDevice({ createdBy: userId });
      const otherId = await testApp.createTestUser({ name: "Other" });
      const theirs = await testApp.createIotDevice({ createdBy: otherId });

      await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.addIotDeviceGroupMembers, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .send({ deviceIds: [mine.id, theirs.id] })
        .expect(StatusCodes.FORBIDDEN);

      const roster: SuperTestResponse<IotDeviceGroupMember[]> = await testApp
        .get(
          testApp.resolveOrpcPath(contract.iot.listIotDeviceGroupMembers, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .expect(StatusCodes.OK);
      expect(roster.body).toHaveLength(0);
    });

    it("rejects a batch containing an unknown device (404)", async () => {
      const group = await createGroup();

      await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.addIotDeviceGroupMembers, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .send({ deviceIds: [faker.string.uuid()] })
        .expect(StatusCodes.NOT_FOUND);
    });
  });
});
