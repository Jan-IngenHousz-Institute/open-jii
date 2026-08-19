import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { GetDeletionBlockersUseCase } from "./get-deletion-blockers";

describe("GetDeletionBlockersUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetDeletionBlockersUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(GetDeletionBlockersUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns no blockers when the user administers nothing", async () => {
    const result = await useCase.execute(testUserId);

    assertSuccess(result);
    expect(result.value).toEqual({ resources: [], organizations: [] });
  });

  // Organizations sit beside the resources rather than among them: they are cleared
  // by promoting another owner or deleting the organization, not by the dialog's
  // per-resource admin hand-off, so they carry no transfer candidates.
  it("lists a shared organization the user solely owns, with no resources of its own", async () => {
    const org = await testApp.createOrganization("Lone Lab", { slug: "lone-lab" });
    await testApp.addOrganizationMember(org, testUserId, "owner");

    const result = await useCase.execute(testUserId);

    assertSuccess(result);
    expect(result.value).toEqual({
      resources: [],
      organizations: [{ id: org, name: "Lone Lab", slug: "lone-lab" }],
    });
  });

  it("leaves the organization list empty for the user's personal workspace", async () => {
    await testApp.personalOrganizationId(testUserId);

    const result = await useCase.execute(testUserId);

    assertSuccess(result);
    expect(result.value.organizations).toEqual([]);
  });

  it("returns an experiment where the user is the only admin", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Sole Admin Experiment",
      userId: testUserId,
    });

    const result = await useCase.execute(testUserId);

    assertSuccess(result);
    expect(result.value.resources).toHaveLength(1);
    expect(result.value.resources[0]).toMatchObject({
      resourceType: "experiment",
      id: experiment.id,
      name: experiment.name,
    });
  });

  // All four types are created with a creator admin grant, so all four can end up
  // with a single named admin and block the deletion.
  it.each([
    [
      "macro" as const,
      () => testApp.createMacro({ name: `Macro ${crypto.randomUUID()}`, createdBy: testUserId }),
    ],
    [
      "protocol" as const,
      () =>
        testApp.createProtocol({ name: `Protocol ${crypto.randomUUID()}`, createdBy: testUserId }),
    ],
    [
      "workbook" as const,
      () =>
        testApp.createWorkbook({ name: `Workbook ${crypto.randomUUID()}`, createdBy: testUserId }),
    ],
  ])("returns a %s where the user is the only admin", async (resourceType, create) => {
    const resource = await create();

    const result = await useCase.execute(testUserId);

    assertSuccess(result);
    expect(result.value.resources).toEqual([
      {
        resourceType,
        id: resource.id,
        name: resource.name,
        // Only experiments carry a lifecycle status.
        status: null,
        candidates: [],
      },
    ]);
  });

  it("does not block a macro that has a second admin", async () => {
    const macro = await testApp.createMacro({
      name: `Co-owned Macro ${crypto.randomUUID()}`,
      createdBy: testUserId,
    });
    const otherAdminId = await testApp.createTestUser({ email: "macro-admin@example.com" });
    await testApp.addResourceAdmin("macro", macro.id, otherAdminId);

    const result = await useCase.execute(testUserId);

    assertSuccess(result);
    expect(result.value.resources).toEqual([]);
  });

  it("offers a macro's other collaborators as transfer candidates", async () => {
    const macro = await testApp.createMacro({
      name: `Shared Macro ${crypto.randomUUID()}`,
      createdBy: testUserId,
    });
    const viewerId = await testApp.createTestUser({ email: "macro-viewer@example.com" });
    await testApp.addResourceGrant({
      resourceType: "macro",
      resourceId: macro.id,
      granteeType: "user",
      granteeId: viewerId,
      role: "viewer",
    });

    const result = await useCase.execute(testUserId);

    assertSuccess(result);
    expect(result.value.resources).toHaveLength(1);
    expect(result.value.resources[0].candidates.map((c) => c.userId)).toEqual([viewerId]);
  });

  it("includes archived experiments as blockers", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Archived Sole Admin Experiment",
      userId: testUserId,
      status: "archived",
    });

    const result = await useCase.execute(testUserId);

    assertSuccess(result);
    expect(result.value.resources).toHaveLength(1);
    expect(result.value.resources[0]).toMatchObject({ id: experiment.id, status: "archived" });
  });

  it("does not block when another admin exists", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Shared Admin Experiment",
      userId: testUserId,
    });
    const otherAdminId = await testApp.createTestUser({ email: "other-admin@example.com" });
    await testApp.addExperimentAdmin(experiment.id, otherAdminId);

    const result = await useCase.execute(testUserId);

    assertSuccess(result);
    expect(result.value.resources).toEqual([]);
  });

  // Keys off the clause about *other people's* grants. A deactivated caller's own
  // resource is a different clause, and also blocks — pinned in the sharing spec.
  it("still blocks when the only other admin is deactivated", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Deactivated Other Admin Experiment",
      userId: testUserId,
    });
    const deactivatedAdminId = await testApp.createTestUser({
      email: "deactivated-other-admin@example.com",
      activated: false,
    });
    await testApp.addExperimentAdmin(experiment.id, deactivatedAdminId);

    const result = await useCase.execute(testUserId);

    assertSuccess(result);
    expect(result.value.resources).toHaveLength(1);
    expect(result.value.resources[0]).toMatchObject({ id: experiment.id });
  });

  it("still blocks when the only other admin's account is closed", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Closed Other Admin Experiment",
      userId: testUserId,
    });
    const closedAdminId = await testApp.createTestUser({
      email: "closed-other-admin@example.com",
      deletedAt: new Date(),
    });
    await testApp.addExperimentAdmin(experiment.id, closedAdminId);

    const result = await useCase.execute(testUserId);

    assertSuccess(result);
    expect(result.value.resources).toHaveLength(1);
    expect(result.value.resources[0]).toMatchObject({ id: experiment.id });
  });

  it("lists the experiment's other members as candidates, excluding the user", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Experiment With A Member",
      userId: testUserId,
    });
    const memberId = await testApp.createTestUser({ email: "member@example.com" });
    await testApp.addExperimentCollaborator(experiment.id, memberId);

    const result = await useCase.execute(testUserId);

    assertSuccess(result);
    expect(result.value.resources).toHaveLength(1);
    const candidateIds = result.value.resources[0].candidates.map((c) => c.userId);
    expect(candidateIds).toEqual([memberId]);
    expect(candidateIds).not.toContain(testUserId);
  });

  it("excludes deactivated members from the transfer candidates", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Experiment With A Deactivated Member",
      userId: testUserId,
    });
    const activeMemberId = await testApp.createTestUser({ email: "active-member@example.com" });
    const deactivatedMemberId = await testApp.createTestUser({
      email: "deactivated-member@example.com",
      activated: false,
    });
    await testApp.addExperimentCollaborator(experiment.id, activeMemberId);
    await testApp.addExperimentCollaborator(experiment.id, deactivatedMemberId);

    const result = await useCase.execute(testUserId);

    assertSuccess(result);
    expect(result.value.resources).toHaveLength(1);
    const candidateIds = result.value.resources[0].candidates.map((c) => c.userId);
    expect(candidateIds).toEqual([activeMemberId]);
    expect(candidateIds).not.toContain(deactivatedMemberId);
  });
});
