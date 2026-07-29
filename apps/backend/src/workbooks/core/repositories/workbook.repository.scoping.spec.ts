import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { SuperTestResponse } from "../../../test/test-harness";
import { WorkbookRepository } from "./workbook.repository";

/**
 * Access scoping for workbook listing: a private workbook is only visible to
 * owning-org members and grantees; public workbooks are visible to everyone. Mirrors the experiment `findAll` scoping.
 */
describe("WorkbookRepository — list access scoping", () => {
  const testApp = TestHarness.App;
  let repository: WorkbookRepository;
  let owner: string;
  let orgId: string;
  let privateId: string;
  let publicId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(WorkbookRepository);

    owner = await testApp.createTestUser({ name: "Workbook Owner" });
    orgId = await testApp.createOrganization();
    await testApp.addOrganizationMember(orgId, owner, "owner");

    const priv = await testApp.createWorkbook({
      name: "Private workbook",
      createdBy: owner,
      visibility: "private",
      organizationId: orgId,
    });
    privateId = priv.id;

    const pub = await testApp.createWorkbook({
      name: "Public workbook",
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
    const result = await repository.findAll({ userId });
    assertSuccess(result);
    return result.value.map((w) => w.id);
  };

  it("hides a private workbook from a stranger but shows the public one", async () => {
    const stranger = await testApp.createTestUser({ name: "Stranger" });

    const ids = await listIdsFor(stranger);

    expect(ids).toContain(publicId);
    expect(ids).not.toContain(privateId);
  });

  it("shows a private workbook to a member of the owning organization", async () => {
    const orgMember = await testApp.createTestUser({ name: "Org Member" });
    await testApp.addOrganizationMember(orgId, orgMember, "member");

    const ids = await listIdsFor(orgMember);

    expect(ids).toContain(privateId);
    expect(ids).toContain(publicId);
  });

  it("shows a private workbook to a direct user grantee", async () => {
    const grantee = await testApp.createTestUser({ name: "User Grantee" });
    await testApp.addResourceGrant({
      resourceType: "workbook",
      resourceId: privateId,
      granteeType: "user",
      granteeId: grantee,
      role: "viewer",
    });

    const ids = await listIdsFor(grantee);

    expect(ids).toContain(privateId);
  });

  it("shows a private workbook to a member of a grantee organization", async () => {
    const orgGrantee = await testApp.createTestUser({ name: "Org Grantee" });
    const granteeOrgId = await testApp.createOrganization();
    await testApp.addOrganizationMember(granteeOrgId, orgGrantee, "member");
    await testApp.addResourceGrant({
      resourceType: "workbook",
      resourceId: privateId,
      granteeType: "organization",
      granteeId: granteeOrgId,
      role: "viewer",
    });

    const ids = await listIdsFor(orgGrantee);

    expect(ids).toContain(privateId);
  });

  it("shows the owner both workbooks", async () => {
    const ids = await listIdsFor(owner);

    expect(ids).toContain(privateId);
    expect(ids).toContain(publicId);
  });

  it("shows only public workbooks when there is no caller", async () => {
    const ids = await listIdsFor(undefined);

    expect(ids).toContain(publicId);
    expect(ids).not.toContain(privateId);
  });

  it('keeps the "my" filter as an ownership view, unaffected by visibility', async () => {
    const other = await testApp.createTestUser({ name: "Other Author" });
    const othersWorkbook = await testApp.createWorkbook({
      name: "Someone else's workbook",
      createdBy: other,
      visibility: "public",
    });

    const result = await repository.findAll({ filter: "my", userId: owner });
    assertSuccess(result);
    const ids = result.value.map((w) => w.id);

    expect(ids).toEqual(expect.arrayContaining([privateId, publicId]));
    expect(ids).not.toContain(othersWorkbook.id);
  });

  it("does not surface a public workbook via a private linked protocol's name to a stranger", async () => {
    // A public workbook references a private protocol. Probing the private
    // protocol's name must not reveal the association to a caller who cannot
    // read that protocol, yet the linked-name search
    // still works for someone who can (the owning-org member).
    const linkedProtocol = await testApp.createProtocol({
      name: "Xylophonium reagent",
      createdBy: owner,
      visibility: "private",
      organizationId: orgId,
    });
    const holderWorkbook = await testApp.createWorkbook({
      name: "Plain holder workbook",
      createdBy: owner,
      visibility: "public",
      organizationId: orgId,
      cells: [
        {
          id: "p1",
          type: "protocol",
          isCollapsed: false,
          payload: { protocolId: linkedProtocol.id, version: 1 },
        },
      ],
    });

    const stranger = await testApp.createTestUser({ name: "Prober" });
    const strangerHits = await repository.findAll({ search: "Xylophonium", userId: stranger });
    assertSuccess(strangerHits);
    expect(strangerHits.value.map((w) => w.id)).not.toContain(holderWorkbook.id);

    const ownerHits = await repository.findAll({ search: "Xylophonium", userId: owner });
    assertSuccess(ownerHits);
    expect(ownerHits.value.map((w) => w.id)).toContain(holderWorkbook.id);
  });
});

/**
 * Private-at-create round-trip: the create route accepts an optional visibility
 * (default public) and persists it; the update body never carries visibility.
 */
describe("WorkbookController — create with visibility", () => {
  const testApp = TestHarness.App;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup();
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

  const createPath = () => testApp.resolveOrpcPath(contract.workbooks.createWorkbook);

  it("persists visibility=private when requested", async () => {
    const response: SuperTestResponse<{ id: string; visibility: string }> = await testApp
      .post(createPath())
      .withAuth(testUserId)
      .send({ name: "Private at create", visibility: "private" })
      .expect(StatusCodes.CREATED);

    expect(response.body.visibility).toBe("private");
  });

  it("defaults to public when visibility is omitted", async () => {
    const response: SuperTestResponse<{ id: string; visibility: string }> = await testApp
      .post(createPath())
      .withAuth(testUserId)
      .send({ name: "Default visibility" })
      .expect(StatusCodes.CREATED);

    expect(response.body.visibility).toBe("public");
  });
});
