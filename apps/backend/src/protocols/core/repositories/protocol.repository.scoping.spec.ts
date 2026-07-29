import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { SuperTestResponse } from "../../../test/test-harness";
import { ProtocolRepository } from "./protocol.repository";

/**
 * Access scoping for protocol listing: a private protocol is only visible to
 * owning-org members and grantees; public protocols are visible to everyone. Mirrors the experiment `findAll` scoping.
 */
describe("ProtocolRepository — list access scoping", () => {
  const testApp = TestHarness.App;
  let repository: ProtocolRepository;
  let owner: string;
  let orgId: string;
  let privateId: string;
  let publicId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ProtocolRepository);

    owner = await testApp.createTestUser({ name: "Protocol Owner" });
    orgId = await testApp.createOrganization();
    await testApp.addOrganizationMember(orgId, owner, "owner");

    const priv = await testApp.createProtocol({
      name: "Private protocol",
      createdBy: owner,
      visibility: "private",
      organizationId: orgId,
    });
    privateId = priv.id;

    const pub = await testApp.createProtocol({
      name: "Public protocol",
      createdBy: owner,
      visibility: "public",
      organizationId: orgId,
    });
    publicId = pub.id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const listIdsFor = async (userId: string | undefined) => {
    const result = await repository.findAll(undefined, undefined, userId);
    assertSuccess(result);
    return result.value.map((p) => p.id);
  };

  it("hides a private protocol from a stranger but shows the public one", async () => {
    const stranger = await testApp.createTestUser({ name: "Stranger" });

    const ids = await listIdsFor(stranger);

    expect(ids).toContain(publicId);
    expect(ids).not.toContain(privateId);
  });

  it("shows a private protocol to a member of the owning organization", async () => {
    const orgMember = await testApp.createTestUser({ name: "Org Member" });
    await testApp.addOrganizationMember(orgId, orgMember, "member");

    const ids = await listIdsFor(orgMember);

    expect(ids).toContain(privateId);
    expect(ids).toContain(publicId);
  });

  it("shows a private protocol to a direct user grantee", async () => {
    const grantee = await testApp.createTestUser({ name: "User Grantee" });
    await testApp.addResourceGrant({
      resourceType: "protocol",
      resourceId: privateId,
      granteeType: "user",
      granteeId: grantee,
      role: "viewer",
    });

    const ids = await listIdsFor(grantee);

    expect(ids).toContain(privateId);
  });

  it("shows a private protocol to a member of a grantee organization", async () => {
    const orgGrantee = await testApp.createTestUser({ name: "Org Grantee" });
    const granteeOrgId = await testApp.createOrganization();
    await testApp.addOrganizationMember(granteeOrgId, orgGrantee, "member");
    await testApp.addResourceGrant({
      resourceType: "protocol",
      resourceId: privateId,
      granteeType: "organization",
      granteeId: granteeOrgId,
      role: "viewer",
    });

    const ids = await listIdsFor(orgGrantee);

    expect(ids).toContain(privateId);
  });

  it("shows the owner both protocols", async () => {
    const ids = await listIdsFor(owner);

    expect(ids).toContain(privateId);
    expect(ids).toContain(publicId);
  });

  it("shows only public protocols when there is no caller", async () => {
    const ids = await listIdsFor(undefined);

    expect(ids).toContain(publicId);
    expect(ids).not.toContain(privateId);
  });

  it('keeps the "my" filter as an ownership view, unaffected by visibility', async () => {
    const other = await testApp.createTestUser({ name: "Other Author" });
    const othersProtocol = await testApp.createProtocol({
      name: "Someone else's protocol",
      createdBy: other,
      visibility: "public",
    });

    const result = await repository.findAll(undefined, "my", owner);
    assertSuccess(result);
    const ids = result.value.map((p) => p.id);

    expect(ids).toEqual(expect.arrayContaining([privateId, publicId]));
    expect(ids).not.toContain(othersProtocol.id);
  });
});

/**
 * Private-at-create round-trip: the create route accepts an optional visibility
 * (default public) and persists it; the update body never carries visibility.
 */
describe("ProtocolController — create with visibility", () => {
  const testApp = TestHarness.App;
  let testUserId: string;

  beforeAll(async () => {
    // Mock analytics so protocol code validation runs in warning mode (its
    // default), letting a minimal code array through without a strict schema.
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({ name: "Creator" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const createPath = () => testApp.resolveOrpcPath(contract.protocols.createProtocol);

  it("persists visibility=private when requested", async () => {
    const response: SuperTestResponse<{ id: string; visibility: string }> = await testApp
      .post(createPath())
      .withAuth(testUserId)
      .send({
        name: "Private at create",
        description: "x",
        code: [{ steps: [] }],
        family: "multispeq",
        visibility: "private",
      })
      .expect(StatusCodes.CREATED);

    expect(response.body.visibility).toBe("private");
  });

  it("defaults to public when visibility is omitted", async () => {
    const response: SuperTestResponse<{ id: string; visibility: string }> = await testApp
      .post(createPath())
      .withAuth(testUserId)
      .send({
        name: "Default visibility",
        description: "x",
        code: [{ steps: [] }],
        family: "multispeq",
      })
      .expect(StatusCodes.CREATED);

    expect(response.body.visibility).toBe("public");
  });
});
