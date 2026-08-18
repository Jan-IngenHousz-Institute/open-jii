import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type {
  DeviceGroup,
  DeviceGroupDetail,
  DeviceGroupListItem,
  DeviceGroupMember,
} from "@repo/api/domains/device-group/device-group.schema";

import { TestHarness } from "../../test/test-harness";
import type { SuperTestResponse } from "../../test/test-harness";

describe("IotDeviceGroupController", () => {
  const testApp = TestHarness.App;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function createGroup(name = "Field campaign"): Promise<DeviceGroup> {
    const response: SuperTestResponse<DeviceGroup> = await testApp
      .post(testApp.resolveOrpcPath(contract.deviceGroups.createDeviceGroup))
      .withAuth(userId)
      .send({ name })
      .expect(StatusCodes.CREATED);
    return response.body;
  }

  describe("createDeviceGroup", () => {
    it("creates a private group owned by the caller (201)", async () => {
      const group = await createGroup("Greenhouse A");

      expect(group.name).toBe("Greenhouse A");
      expect(group.visibility).toBe("private");
      expect(group.createdBy).toBe(userId);
      expect(group.organizationId).not.toBeNull();
    });

    it("returns 401 when unauthenticated", async () => {
      await testApp
        .post(testApp.resolveOrpcPath(contract.deviceGroups.createDeviceGroup))
        .withoutAuth()
        .send({ name: "x" })
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("listDeviceGroups", () => {
    it("lists the caller's groups with member counts", async () => {
      const group = await createGroup();
      const device = await testApp.createIotDevice({ createdBy: userId });
      await testApp
        .post(
          testApp.resolveOrpcPath(contract.deviceGroups.addDeviceGroupMembers, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .send({ deviceIds: [device.id] })
        .expect(StatusCodes.OK);

      const response: SuperTestResponse<DeviceGroupListItem[]> = await testApp
        .get(testApp.resolveOrpcPath(contract.deviceGroups.listDeviceGroups))
        .withAuth(userId)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].memberCount).toBe(1);
    });

    it("does not list another user's group", async () => {
      await createGroup();
      const otherId = await testApp.createTestUser({ name: "Other" });

      const response: SuperTestResponse<DeviceGroupListItem[]> = await testApp
        .get(testApp.resolveOrpcPath(contract.deviceGroups.listDeviceGroups))
        .withAuth(otherId)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(0);
    });
  });

  describe("getDeviceGroup", () => {
    it("returns the group with the caller's capabilities (200)", async () => {
      const group = await createGroup();

      const response: SuperTestResponse<DeviceGroupDetail> = await testApp
        .get(testApp.resolveOrpcPath(contract.deviceGroups.getDeviceGroup, { groupId: group.id }))
        .withAuth(userId)
        .expect(StatusCodes.OK);

      expect(response.body.id).toBe(group.id);
      expect(response.body.capabilities.canManage).toBe(true);
    });

    it("returns 403 for another user's private group", async () => {
      const group = await createGroup();
      const otherId = await testApp.createTestUser({ name: "Other" });

      await testApp
        .get(testApp.resolveOrpcPath(contract.deviceGroups.getDeviceGroup, { groupId: group.id }))
        .withAuth(otherId)
        .expect(StatusCodes.FORBIDDEN);
    });
  });

  describe("updateDeviceGroup", () => {
    it("returns 404 for a nonexistent group", async () => {
      await testApp
        .patch(
          testApp.resolveOrpcPath(contract.deviceGroups.updateDeviceGroup, {
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
        .patch(
          testApp.resolveOrpcPath(contract.deviceGroups.updateDeviceGroup, { groupId: group.id }),
        )
        .withAuth(stranger)
        .send({ name: "renamed" })
        .expect(StatusCodes.FORBIDDEN);
    });

    it("renames the group (200)", async () => {
      const group = await createGroup();

      const response: SuperTestResponse<DeviceGroup> = await testApp
        .patch(
          testApp.resolveOrpcPath(contract.deviceGroups.updateDeviceGroup, { groupId: group.id }),
        )
        .withAuth(userId)
        .send({ name: "Renamed" })
        .expect(StatusCodes.OK);

      expect(response.body.name).toBe("Renamed");
    });
  });

  describe("deleteDeviceGroup", () => {
    it("returns 404 when deleting a nonexistent group", async () => {
      await testApp
        .delete(
          testApp.resolveOrpcPath(contract.deviceGroups.deleteDeviceGroup, {
            groupId: faker.string.uuid(),
          }),
        )
        .withAuth(userId)
        .expect(StatusCodes.NOT_FOUND);
    });

    it("deletes the group (204)", async () => {
      const group = await createGroup();

      await testApp
        .delete(
          testApp.resolveOrpcPath(contract.deviceGroups.deleteDeviceGroup, { groupId: group.id }),
        )
        .withAuth(userId)
        .expect(StatusCodes.NO_CONTENT);

      // Gone means gone: the guard resolves a deleted group to 404, not 403.
      await testApp
        .get(testApp.resolveOrpcPath(contract.deviceGroups.getDeviceGroup, { groupId: group.id }))
        .withAuth(userId)
        .expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("membership", () => {
    it("adds devices, lists the shallow roster, and removes a member", async () => {
      const group = await createGroup();
      const device = await testApp.createIotDevice({ createdBy: userId, name: null });

      const added: SuperTestResponse<DeviceGroupMember[]> = await testApp
        .post(
          testApp.resolveOrpcPath(contract.deviceGroups.addDeviceGroupMembers, {
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
          testApp.resolveOrpcPath(contract.deviceGroups.removeDeviceGroupMember, {
            groupId: group.id,
            deviceId: device.id,
          }),
        )
        .withAuth(userId)
        .expect(StatusCodes.NO_CONTENT);

      const roster: SuperTestResponse<DeviceGroupMember[]> = await testApp
        .get(
          testApp.resolveOrpcPath(contract.deviceGroups.listDeviceGroupMembers, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .expect(StatusCodes.OK);
      expect(roster.body).toHaveLength(0);
    });

    it("re-adding a member is a no-op, not an error", async () => {
      const group = await createGroup();
      const device = await testApp.createIotDevice({ createdBy: userId });
      const path = testApp.resolveOrpcPath(contract.deviceGroups.addDeviceGroupMembers, {
        groupId: group.id,
      });

      await testApp
        .post(path)
        .withAuth(userId)
        .send({ deviceIds: [device.id] })
        .expect(200);
      const again: SuperTestResponse<DeviceGroupMember[]> = await testApp
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
          testApp.resolveOrpcPath(contract.deviceGroups.addDeviceGroupMembers, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .send({ deviceIds: [mine.id, theirs.id] })
        .expect(StatusCodes.FORBIDDEN);

      const roster: SuperTestResponse<DeviceGroupMember[]> = await testApp
        .get(
          testApp.resolveOrpcPath(contract.deviceGroups.listDeviceGroupMembers, {
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
          testApp.resolveOrpcPath(contract.deviceGroups.addDeviceGroupMembers, {
            groupId: group.id,
          }),
        )
        .withAuth(userId)
        .send({ deviceIds: [faker.string.uuid()] })
        .expect(StatusCodes.NOT_FOUND);
    });
  });
});
