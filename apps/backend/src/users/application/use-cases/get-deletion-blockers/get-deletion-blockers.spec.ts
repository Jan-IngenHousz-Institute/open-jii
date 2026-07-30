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
    expect(result.value).toEqual([]);
  });

  it("returns an experiment where the user is the only admin", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Sole Admin Experiment",
      userId: testUserId,
    });

    const result = await useCase.execute(testUserId);

    assertSuccess(result);
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toMatchObject({
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
    expect(result.value).toEqual([
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
    expect(result.value).toEqual([]);
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
    expect(result.value).toHaveLength(1);
    expect(result.value[0].candidates.map((c) => c.userId)).toEqual([viewerId]);
  });

  it("includes archived experiments as blockers", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Archived Sole Admin Experiment",
      userId: testUserId,
      status: "archived",
    });

    const result = await useCase.execute(testUserId);

    assertSuccess(result);
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toMatchObject({ id: experiment.id, status: "archived" });
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
    expect(result.value).toEqual([]);
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
    expect(result.value).toHaveLength(1);
    const candidateIds = result.value[0].candidates.map((c) => c.userId);
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
    expect(result.value).toHaveLength(1);
    const candidateIds = result.value[0].candidates.map((c) => c.userId);
    expect(candidateIds).toEqual([activeMemberId]);
    expect(candidateIds).not.toContain(deactivatedMemberId);
  });
});
