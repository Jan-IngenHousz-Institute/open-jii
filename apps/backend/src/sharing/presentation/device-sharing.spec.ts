import { StatusCodes } from "http-status-codes";

import { FEATURE_FLAGS } from "@repo/analytics";
import { contract } from "@repo/api/contract";
import { isGranteeRow } from "@repo/api/domains/sharing/sharing.schema";
import type { ResourceCollaboratorDto } from "@repo/api/domains/sharing/sharing.schema";

import { AuthorizationService } from "../../authorization/authorization.service";
import { AnalyticsAdapter } from "../../common/modules/analytics/analytics.adapter";
import { assertSuccess } from "../../common/utils/fp-utils";
import { ListIotDevicesUseCase } from "../../iot/application/use-cases/list-iot-devices/list-iot-devices";
import type { MockAnalyticsAdapter } from "../../test/mocks/adapters/analytics.adapter.mock";
import { TestHarness } from "../../test/test-harness";

/**
 * Devices on the sharing surface, end to end over HTTP.
 *
 * A device is the one shareable type that is **permanently private** — nothing may
 * publish it — so sharing is the *only* way anybody but the owning organization
 * ever sees one. That makes two things worth pinning here rather than leaving to
 * the generic sharing specs:
 *
 * 1. what each tier actually buys on a device, since "Can edit" reaches real AWS
 *    hardware (delete the Thing, issue/rotate/revoke its certificate);
 * 2. that a share is what makes the device appear in the grantee's registry — the
 *    listing's grant tier had no writer until now.
 */
describe("device sharing", () => {
  const testApp = TestHarness.App;
  let authz: AuthorizationService;
  let listDevices: ListIotDevicesUseCase;
  let analyticsAdapter: MockAnalyticsAdapter;
  let owner: string;
  let grantee: string;

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    authz = testApp.module.get(AuthorizationService);
    listDevices = testApp.module.get(ListIotDevicesUseCase);
    // The device routes are behind the registry feature flag, which refuses with a
    // 403 of its own. Turning it on is what makes an assertion of 403 below mean
    // "the authorization guard refused", not "the feature is off".
    analyticsAdapter = testApp.module.get(AnalyticsAdapter);
    analyticsAdapter.setFlag(FEATURE_FLAGS.IOT_DEVICES, true);
    owner = await testApp.createTestUser({ name: "Device Owner" });
    grantee = await testApp.createTestUser({ name: "Device Grantee" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const collaboratorsPath = (deviceId: string) =>
    testApp.resolveOrpcPath(contract.sharing.listGrants, { resourceType: "device", id: deviceId });

  const can = async (userId: string, deviceId: string, action: "read" | "manage" | "share") =>
    (await authz.can(userId, { resourceType: "device", resourceId: deviceId, action })).allow;

  /** The device ids the user's registry shows them. */
  const visibleDeviceIds = async (userId: string) => {
    const result = await listDevices.execute(userId);
    assertSuccess(result);
    return result.value.map((device) => device.id);
  };

  /**
   * The grant row a grantee holds, out of a collaborators response. Narrowed on the
   * `kind` discriminator rather than asserted: an Owner row carries no grant id, so
   * asking for one is a mistake worth failing on here.
   */
  const grantRowFor = (rows: ResourceCollaboratorDto[], granteeId: string) => {
    const row = rows.find(
      (candidate) => isGranteeRow(candidate) && candidate.granteeId === granteeId,
    );
    if (row?.kind !== "grant") {
      throw new Error(`Expected a grant row for ${granteeId}, got ${row?.kind ?? "nothing"}`);
    }
    return row;
  };

  it("walks a share through grant, list, tier change, revoke", async () => {
    const device = await testApp.createIotDevice({ createdBy: owner });

    // Devices are private with no publish path, so before the share the grantee
    // cannot even read this one.
    expect(await can(grantee, device.id, "read")).toBe(false);

    const created = await testApp
      .post(collaboratorsPath(device.id))
      .withAuth(owner)
      .send({ granteeType: "user", granteeId: grantee, role: "viewer" })
      .expect(StatusCodes.CREATED);

    // The owner appears as a synthesized Owner row, the grantee as a grant row.
    const rows = created.body as ResourceCollaboratorDto[];
    expect(rows.find((row) => isGranteeRow(row) && row.granteeId === owner)?.kind).toBe("owner");
    const grant = grantRowFor(rows, grantee);
    expect(grant.role).toBe("viewer");

    expect(await can(grantee, device.id, "read")).toBe(true);
    expect(await can(grantee, device.id, "manage")).toBe(false);

    const listed = await testApp
      .get(collaboratorsPath(device.id))
      .withAuth(owner)
      .expect(StatusCodes.OK);
    expect(
      (listed.body as ResourceCollaboratorDto[])
        .flatMap((row) => (isGranteeRow(row) ? [row.granteeId] : []))
        .sort(),
    ).toEqual([owner, grantee].sort());

    await testApp
      .patch(
        testApp.resolveOrpcPath(contract.sharing.updateGrant, {
          resourceType: "device",
          id: device.id,
          grantId: grant.id,
        }),
      )
      .withAuth(owner)
      .send({ role: "admin" })
      .expect(StatusCodes.OK);

    // Raised to "Can edit": full control, which on a device is the certificates too.
    expect(await can(grantee, device.id, "manage")).toBe(true);
    expect(await can(grantee, device.id, "share")).toBe(true);

    await testApp
      .delete(
        testApp.resolveOrpcPath(contract.sharing.revokeGrant, {
          resourceType: "device",
          id: device.id,
          grantId: grant.id,
        }),
      )
      .withAuth(owner)
      .expect(StatusCodes.NO_CONTENT);

    // Nothing to fall through to: a revoked device grantee loses the device
    // entirely, because private is the only state a device has.
    expect(await can(grantee, device.id, "read")).toBe(false);
  });

  it("lets a grantee leave a device they were shared", async () => {
    const device = await testApp.createIotDevice({ createdBy: owner });
    await testApp.addResourceGrant({
      resourceType: "device",
      resourceId: device.id,
      granteeType: "user",
      granteeId: grantee,
      role: "viewer",
    });

    await testApp
      .delete(
        testApp.resolveOrpcPath(contract.sharing.leaveResource, {
          resourceType: "device",
          id: device.id,
        }),
      )
      .withAuth(grantee)
      .expect(StatusCodes.NO_CONTENT);

    expect(await can(grantee, device.id, "read")).toBe(false);
  });

  it("puts a shared device in the grantee's registry and takes it back out on revoke", async () => {
    const device = await testApp.createIotDevice({ createdBy: owner });

    expect(await visibleDeviceIds(grantee)).not.toContain(device.id);

    const created = await testApp
      .post(collaboratorsPath(device.id))
      .withAuth(owner)
      .send({ granteeType: "user", granteeId: grantee, role: "viewer" })
      .expect(StatusCodes.CREATED);
    const grant = grantRowFor(created.body as ResourceCollaboratorDto[], grantee);

    expect(await visibleDeviceIds(grantee)).toContain(device.id);

    await testApp
      .delete(
        testApp.resolveOrpcPath(contract.sharing.revokeGrant, {
          resourceType: "device",
          id: device.id,
          grantId: grant.id,
        }),
      )
      .withAuth(owner)
      .expect(StatusCodes.NO_CONTENT);

    expect(await visibleDeviceIds(grantee)).not.toContain(device.id);
  });

  it("hides the collaborators list from a 'Can view' grantee", async () => {
    const device = await testApp.createIotDevice({ createdBy: owner });
    await testApp.addResourceGrant({
      resourceType: "device",
      resourceId: device.id,
      granteeType: "user",
      granteeId: grantee,
      role: "viewer",
    });

    // Listing is gated on `share`, not `read`: being shown a device does not
    // entitle you to enumerate who else holds it.
    await testApp.get(collaboratorsPath(device.id)).withAuth(grantee).expect(StatusCodes.FORBIDDEN);
  });

  it("refuses a 'Can view' grantee every credential operation", async () => {
    const device = await testApp.createIotDevice({ createdBy: owner, status: "active" });
    await testApp.addResourceGrant({
      resourceType: "device",
      resourceId: device.id,
      granteeType: "user",
      granteeId: grantee,
      role: "viewer",
    });

    // All three gate on `manage`, so the guard refuses before any AWS call is made
    // — which is also why this test needs no AWS mocking to be meaningful.
    await testApp
      .post(testApp.resolveOrpcPath(contract.iot.rotateIotCredentials, { deviceId: device.id }))
      .withAuth(grantee)
      .send({})
      .expect(StatusCodes.FORBIDDEN);
    await testApp
      .post(testApp.resolveOrpcPath(contract.iot.issueIotCredentials, { deviceId: device.id }))
      .withAuth(grantee)
      .send({})
      .expect(StatusCodes.FORBIDDEN);
    await testApp
      .delete(testApp.resolveOrpcPath(contract.iot.revokeIotCredentials, { deviceId: device.id }))
      .withAuth(grantee)
      .expect(StatusCodes.FORBIDDEN);
    await testApp
      .delete(testApp.resolveOrpcPath(contract.iot.deleteIotDevice, { deviceId: device.id }))
      .withAuth(grantee)
      .expect(StatusCodes.FORBIDDEN);
  });

  it("shares a device with a whole organization", async () => {
    const device = await testApp.createIotDevice({ createdBy: owner });
    const org = await testApp.createOrganization();
    await testApp.addOrganizationMember(org, owner, "owner");
    const member = await testApp.createTestUser({ name: "Org Member" });
    await testApp.addOrganizationMember(org, member, "member");

    await testApp
      .post(collaboratorsPath(device.id))
      .withAuth(owner)
      .send({ granteeType: "organization", granteeId: org, role: "viewer" })
      .expect(StatusCodes.CREATED);

    expect(await can(member, device.id, "read")).toBe(true);
    expect(await can(member, device.id, "manage")).toBe(false);
  });
});
