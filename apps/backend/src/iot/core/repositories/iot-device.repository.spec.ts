import { faker } from "@faker-js/faker";

import { deviceRung } from "@repo/api/domains/iot/device-rung";
import type {
  IotDeviceRung,
  IotDeviceSort,
  IotDeviceStatus,
} from "@repo/api/domains/iot/iot.schema";
import {
  and,
  asc,
  eq,
  experimentDevices,
  iotDevices,
  organizationMembers,
  resourceGrants,
} from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { IotDeviceDto, CreateIotDeviceDto } from "../models/iot-device.model";
import { deviceRungSql, IotDeviceRepository } from "./iot-device.repository";

describe("IotDeviceRepository", () => {
  const testApp = TestHarness.App;
  let repository: IotDeviceRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "IotDevice Owner" });
    repository = testApp.module.get(IotDeviceRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const buildDto = (overrides: Partial<CreateIotDeviceDto> = {}): CreateIotDeviceDto => {
    const thingName = `generic_${faker.string.uuid()}`;
    return {
      thingName,
      thingArn: `arn:aws:iot:eu-central-1:000000000000:thing/${thingName}`,
      serialNumber: faker.string.alphanumeric(12),
      name: "Test device",
      deviceType: "generic",
      ...overrides,
    };
  };

  it("creates a device and persists it", async () => {
    const dto = buildDto();

    const result = await repository.create(dto, userId);

    assertSuccess(result);
    const device = result.value[0];
    expect(device.serialNumber).toBe(dto.serialNumber);
    expect(device.status).toBe("registered");

    const rows = await testApp.database
      .select()
      .from(iotDevices)
      .where(eq(iotDevices.id, device.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].createdBy).toBe(userId);
  });

  it("lists devices the caller created", async () => {
    await repository.create(buildDto(), userId);
    await repository.create(buildDto(), userId);
    const otherUser = await testApp.createTestUser({});
    await repository.create(buildDto(), otherUser);

    const result = await repository.listAccessible(userId);

    assertSuccess(result);
    expect(result.value).toHaveLength(2);
  });

  it("returns null from findById for a missing device", async () => {
    const result = await repository.findById(faker.string.uuid());

    assertSuccess(result);
    expect(result.value).toBeNull();
  });

  it("findById is not owner-scoped (authorization is enforced by the @CanAccess guard)", async () => {
    const created = await repository.create(buildDto(), userId);
    assertSuccess(created);

    const result = await repository.findById(created.value[0].id);

    assertSuccess(result);
    expect(result.value?.id).toBe(created.value[0].id);
  });

  it("finds a device by serial number", async () => {
    const dto = buildDto();
    await repository.create(dto, userId);

    const result = await repository.findBySerialNumber(dto.serialNumber);

    assertSuccess(result);
    expect(result.value?.serialNumber).toBe(dto.serialNumber);
  });

  it("resolves thing names to registry rows across owners", async () => {
    const otherUser = await testApp.createTestUser({ name: "Other Owner" });
    const mine = buildDto();
    const theirs = buildDto();
    await repository.create(mine, userId);
    await repository.create(theirs, otherUser);

    const result = await repository.findByThingNames([mine.thingName, theirs.thingName, "missing"]);

    assertSuccess(result);
    expect(result.value.map((d) => d.thingName).sort()).toEqual(
      [mine.thingName, theirs.thingName].sort(),
    );
  });

  it("returns an empty list without querying for an empty batch", async () => {
    const result = await repository.findByThingNames([]);

    assertSuccess(result);
    expect(result.value).toEqual([]);
  });

  it("deletes a device", async () => {
    const created = await repository.create(buildDto(), userId);
    assertSuccess(created);

    const del = await repository.delete(created.value[0].id);

    assertSuccess(del);
    const rows = await testApp.database
      .select()
      .from(iotDevices)
      .where(eq(iotDevices.id, created.value[0].id));
    expect(rows).toHaveLength(0);
  });
});

/**
 * Org-aware device listing: `listAccessible` is `accessibleResourceCondition` and
 * nothing else — owning-org member OR grantee OR public, the same scoping every other
 * type's `findAll` uses. Devices have no publish surface, so the public tier is
 * unreachable in production and the grant tier is dormant; both are asserted here with
 * hand-inserted grants and visibility to prove they light up when the device product
 * surface lands.
 */
describe("IotDeviceRepository — listAccessible scoping", () => {
  const testApp = TestHarness.App;
  let repository: IotDeviceRepository;
  let owner: string;
  let orgId: string;
  let privateDeviceId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(IotDeviceRepository);

    owner = await testApp.createTestUser({ name: "Device Owner" });
    orgId = await testApp.createOrganization();
    await testApp.addOrganizationMember(orgId, owner, "owner");

    // Devices default to private; own it with the standalone org.
    const priv = await testApp.createIotDevice({ createdBy: owner, organizationId: orgId });
    privateDeviceId = priv.id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const listIdsFor = async (uid: string) => {
    const result = await repository.listAccessible(uid);
    assertSuccess(result);
    return result.value.map((d) => d.id);
  };

  it("hides a private device from a stranger", async () => {
    const stranger = await testApp.createTestUser({ name: "Stranger" });

    expect(await listIdsFor(stranger)).not.toContain(privateDeviceId);
  });

  it("shows a device to its creator", async () => {
    expect(await listIdsFor(owner)).toContain(privateDeviceId);
  });

  it("shows a private device to a member of the owning organization", async () => {
    const orgMember = await testApp.createTestUser({ name: "Org Member" });
    await testApp.addOrganizationMember(orgId, orgMember, "member");

    expect(await listIdsFor(orgMember)).toContain(privateDeviceId);
  });

  it("shows a private device to a direct user grantee (dormant tier)", async () => {
    const grantee = await testApp.createTestUser({ name: "User Grantee" });
    await testApp.addResourceGrant({
      resourceType: "device",
      resourceId: privateDeviceId,
      granteeType: "user",
      granteeId: grantee,
      role: "viewer",
    });

    expect(await listIdsFor(grantee)).toContain(privateDeviceId);
  });

  it("shows a private device to a member of a grantee organization (dormant tier)", async () => {
    const orgGrantee = await testApp.createTestUser({ name: "Org Grantee" });
    const granteeOrgId = await testApp.createOrganization();
    await testApp.addOrganizationMember(granteeOrgId, orgGrantee, "member");
    await testApp.addResourceGrant({
      resourceType: "device",
      resourceId: privateDeviceId,
      granteeType: "organization",
      granteeId: granteeOrgId,
      role: "viewer",
    });

    expect(await listIdsFor(orgGrantee)).toContain(privateDeviceId);
  });

  it("shows a public device to anyone (dormant tier)", async () => {
    const stranger = await testApp.createTestUser({ name: "Stranger" });
    const pub = await testApp.createIotDevice({
      createdBy: owner,
      organizationId: orgId,
      visibility: "public",
    });

    expect(await listIdsFor(stranger)).toContain(pub.id);
  });

  /**
   * This asserted the opposite — that `createdBy` kept the device listed for its creator
   * after they left the owning organization. That arm was a leftover from when the device
   * registry shipped standalone and authorship *was* the access model; devices were the
   * only type where making something granted a permanent read on it, while migration
   * `0041` had already deleted creators' own grants across all five so they would behave
   * identically. Removed, so a device is reached the same way every other resource is.
   *
   * Both reads are asserted, because the property that matters is that they agree: the
   * user-wide device listing and the organization showcase now narrow together.
   */
  it("stops showing the creator their private device once they leave the owning org", async () => {
    await testApp.database
      .delete(organizationMembers)
      .where(
        and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, owner)),
      );

    expect(await listIdsFor(owner)).not.toContain(privateDeviceId);

    const scopedToOrg = await repository.listAccessible(owner, { organizationId: orgId });
    assertSuccess(scopedToOrg);
    expect(scopedToOrg.value.map((d) => d.id)).not.toContain(privateDeviceId);
  });

  it("still shows the creator their device while they remain a member", async () => {
    // Not vacuous: the removal above must not have cost a creator who is still in the
    // organization the access their membership gives them.
    expect(await listIdsFor(owner)).toContain(privateDeviceId);
  });

  it("scopes to one organization when asked, without widening what is visible", async () => {
    const otherOrg = await testApp.createOrganization();
    await testApp.addOrganizationMember(otherOrg, owner, "owner");
    const elsewhere = await testApp.createIotDevice({
      createdBy: owner,
      organizationId: otherOrg,
    });

    const all = await listIdsFor(owner);
    expect(all).toContain(privateDeviceId);
    expect(all).toContain(elsewhere.id);

    const scoped = await repository.listAccessible(owner, { organizationId: orgId });
    assertSuccess(scoped);
    expect(scoped.value.map((d) => d.id)).toEqual([privateDeviceId]);
  });

  describe("grant teardown on delete", () => {
    let owner: string;
    let grantee: string;

    beforeEach(async () => {
      owner = await testApp.createTestUser({ name: "Teardown Owner" });
      grantee = await testApp.createTestUser({ name: "Teardown Grantee" });
    });

    /** The grants on one resource — no FK cascade cleans `resource_grants` up. */
    const grantsFor = (resourceId: string) =>
      testApp.database
        .select()
        .from(resourceGrants)
        .where(
          and(eq(resourceGrants.resourceType, "device"), eq(resourceGrants.resourceId, resourceId)),
        );

    async function sharedDevice() {
      const resource = await testApp.createIotDevice({ createdBy: owner });
      await testApp.addResourceGrant({
        resourceType: "device",
        resourceId: resource.id,
        granteeType: "user",
        granteeId: grantee,
        role: "viewer",
      });
      // Only the share above: a creator holds no grant on what they create.
      expect(await grantsFor(resource.id)).toHaveLength(1);
      return resource;
    }

    it("deletes the device's grants along with it", async () => {
      const resource = await sharedDevice();

      assertSuccess(await repository.delete(resource.id));

      expect(await grantsFor(resource.id)).toHaveLength(0);
    });
  });
});

describe("IotDeviceRepository listing", () => {
  const testApp = TestHarness.App;
  let repository: IotDeviceRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });
  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(IotDeviceRepository);
    userId = await testApp.createTestUser({});
  });
  afterEach(() => {
    testApp.afterEach();
  });
  afterAll(async () => {
    await testApp.teardown();
  });

  const cases: { status: IotDeviceStatus; bound: boolean; rung: IotDeviceRung }[] = [
    { status: "registered", bound: false, rung: "registered" },
    { status: "registered", bound: true, rung: "registered" },
    { status: "active", bound: false, rung: "provisioned" },
    { status: "active", bound: true, rung: "onboarded" },
    { status: "revoked", bound: false, rung: "revoked" },
    { status: "revoked", bound: true, rung: "revoked" },
    { status: "retired", bound: false, rung: "retired" },
    { status: "retired", bound: true, rung: "retired" },
  ];

  it("resolves the same rungs as the web helper for every stored status and binding state", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Listing experiment", userId });
    for (const { status, bound, rung } of cases) {
      const device = await testApp.createIotDevice({ createdBy: userId, status });
      if (bound)
        await testApp.database.insert(experimentDevices).values({
          experimentId: experiment.id,
          deviceId: device.id,
          addedBy: userId,
        });
      const [row] = await testApp.database
        .select({ rung: deviceRungSql() })
        .from(iotDevices)
        .where(eq(iotDevices.id, device.id));
      expect(row.rung).toBe(rung);
      expect(row.rung).toBe(deviceRung(status, bound ? 1 : 0));
    }
  });

  it("filters by multiple rungs while counting all rungs under search and family", async () => {
    const { experiment } = await testApp.createExperiment({ name: "Listing experiment", userId });
    for (const [index, { status, bound }] of cases.entries()) {
      const device = await testApp.createIotDevice({
        createdBy: userId,
        status,
        serialNumber: `MSQ-2-${index}`,
        deviceType: "multispeq",
        name: "Sensor",
      });
      if (bound)
        await testApp.database.insert(experimentDevices).values({
          experimentId: experiment.id,
          deviceId: device.id,
          addedBy: userId,
        });
    }
    await testApp.createIotDevice({
      createdBy: userId,
      serialNumber: "MSQ-2-other",
      deviceType: "generic",
    });
    await testApp.createIotDevice({
      createdBy: userId,
      serialNumber: "MSQ-3",
      deviceType: "multispeq",
    });
    const result = await repository.findPage(
      { userId, search: "MSQ-2", family: ["multispeq"], status: ["provisioned", "onboarded"] },
      1,
      20,
    );
    assertSuccess(result);
    expect(result.value.items).toHaveLength(2);
    expect(result.value.items.every((device) => device.status === "active")).toBe(true);
    expect(result.value.totalCount).toBe(2);
    expect(result.value.statusCounts).toEqual({
      registered: 2,
      provisioned: 1,
      onboarded: 1,
      revoked: 2,
      retired: 2,
    });
    const totals: { status?: IotDeviceRung[]; totalCount: number }[] = [
      { totalCount: 8 },
      { status: [], totalCount: 8 },
      { status: ["registered"], totalCount: 2 },
      { status: ["registered", "revoked"], totalCount: 4 },
      { status: ["provisioned", "onboarded"], totalCount: 2 },
    ];
    for (const { status, totalCount } of totals) {
      const page = await repository.findPage(
        { userId, search: "MSQ-2", family: ["multispeq"], status },
        99,
        1,
      );
      assertSuccess(page);
      expect(page.value.items).toEqual([]);
      expect(page.value.totalCount).toBe(totalCount);
      expect(page.value.statusCounts).toEqual(result.value.statusCounts);
    }
  });

  it("escapes wildcard characters and searches names or serials without treating whitespace as a filter", async () => {
    const nameMatch = await testApp.createIotDevice({ createdBy: userId, name: "100%_\\sensor" });
    const serialMatch = await testApp.createIotDevice({
      createdBy: userId,
      serialNumber: "100%_\\serial",
    });
    await testApp.createIotDevice({
      createdBy: userId,
      name: "10000sensor",
      serialNumber: "10000serial",
    });
    const filtered = await repository.findAll({ userId, search: " 100%_\\ " });
    assertSuccess(filtered);
    expect(filtered.value.map((device) => device.id).sort()).toEqual(
      [nameMatch.id, serialMatch.id].sort(),
    );
    const unfiltered = await repository.findPage(
      { userId, search: "  ", status: [], family: [] },
      1,
      20,
    );
    assertSuccess(unfiltered);
    expect(unfiltered.value.totalCount).toBe(3);
  });

  it.each(["name", "status", "family", "registered"] as const)(
    "sorts %s in both directions with stable id ties",
    async (field) => {
      const rows: IotDeviceDto[] = [];
      const statuses = ["registered", "active", "active", "revoked", "retired"] as const;
      const families = ["ambit", "ambyte", "generic", "minipar", "multispeq"] as const;
      const { experiment } = await testApp.createExperiment({ name: "Listing experiment", userId });
      for (let index = 0; index < 5; index++) {
        const device = await testApp.createIotDevice({
          createdBy: userId,
          status: statuses[index],
          deviceType: families[index],
          name: index === 0 ? null : `Name-${index}`,
          serialNumber: index === 0 ? "Name-0" : `serial-${index}`,
        });
        await testApp.database
          .update(iotDevices)
          .set({ createdAt: new Date(2026, 0, index + 1) })
          .where(eq(iotDevices.id, device.id));
        if (index === 2)
          await testApp.database
            .insert(experimentDevices)
            .values({ experimentId: experiment.id, deviceId: device.id, addedBy: userId });
        rows.push(device);
      }
      for (const direction of ["asc", "desc"] as const) {
        const sort: IotDeviceSort = [{ field, direction }];
        const result = await repository.findPage({ userId, sort }, 1, 20);
        assertSuccess(result);
        expect(result.value.items.map((device) => device.id)).toEqual(
          (direction === "asc" ? rows : [...rows].reverse()).map((device) => device.id),
        );
      }
      await testApp.database.update(iotDevices).set({
        name: "Same",
        status: "registered",
        deviceType: "generic",
        createdAt: new Date(2026, 0, 1),
      });
      const expected = await testApp.database
        .select({ id: iotDevices.id })
        .from(iotDevices)
        .orderBy(asc(iotDevices.id));
      for (const direction of ["asc", "desc"] as const) {
        const ids: string[] = [];
        for (let page = 1; page <= 3; page++) {
          const result = await repository.findPage(
            { userId, sort: [{ field, direction }] },
            page,
            2,
          );
          assertSuccess(result);
          ids.push(...result.value.items.map((device) => device.id));
        }
        expect(ids).toEqual(expected.map((device) => device.id));
      }
    },
  );

  it("keeps every access tier and organization-less phones in parity with listAccessible across pages", async () => {
    const owner = await testApp.createTestUser({});
    const orgId = await testApp.createOrganization();
    await testApp.addOrganizationMember(orgId, userId, "member");
    await testApp.createIotDevice({ createdBy: owner, organizationId: orgId });
    const direct = await testApp.createIotDevice({ createdBy: owner });
    await testApp.addResourceGrant({
      resourceType: "device",
      resourceId: direct.id,
      granteeType: "user",
      granteeId: userId,
      role: "viewer",
    });
    const grantedOrg = await testApp.createOrganization();
    await testApp.addOrganizationMember(grantedOrg, userId, "member");
    const orgShared = await testApp.createIotDevice({ createdBy: owner });
    await testApp.addResourceGrant({
      resourceType: "device",
      resourceId: orgShared.id,
      granteeType: "organization",
      granteeId: grantedOrg,
      role: "viewer",
    });
    await testApp.createIotDevice({ createdBy: owner, visibility: "public" });
    const hidden = await testApp.createIotDevice({ createdBy: owner });
    const phone = await testApp.createIotDevice({ createdBy: userId, deviceType: "mobile" });
    const otherPhone = await testApp.createIotDevice({ createdBy: owner, deviceType: "mobile" });
    await testApp.database
      .update(iotDevices)
      .set({ organizationId: null })
      .where(eq(iotDevices.id, phone.id));
    await testApp.database
      .update(iotDevices)
      .set({ organizationId: null })
      .where(eq(iotDevices.id, otherPhone.id));
    const legacy = await repository.listAccessible(userId);
    assertSuccess(legacy);
    const ids: string[] = [];
    for (let page = 1; page <= legacy.value.length; page++) {
      const result = await repository.findPage({ userId }, page, 1);
      assertSuccess(result);
      expect(result.value.totalCount).toBe(legacy.value.length);
      ids.push(...result.value.items.map((device) => device.id));
    }
    expect(ids.sort()).toEqual(legacy.value.map((device) => device.id).sort());
    expect(ids).toContain(phone.id);
    expect(ids).not.toContain(otherPhone.id);
    expect(ids).not.toContain(hidden.id);
    const unpaged = await repository.findAll({ userId, family: ["mobile"] });
    assertSuccess(unpaged);
    expect(unpaged.value.map((device) => device.id)).toEqual([phone.id]);
  });
});
