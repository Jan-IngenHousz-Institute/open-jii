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
    expect(result.value[0]).toMatchObject({ id: experiment.id, name: experiment.name });
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
    await testApp.addExperimentMember(experiment.id, otherAdminId, "admin");

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
    await testApp.addExperimentMember(experiment.id, memberId, "member");

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
    await testApp.addExperimentMember(experiment.id, activeMemberId, "member");
    await testApp.addExperimentMember(experiment.id, deactivatedMemberId, "member");

    const result = await useCase.execute(testUserId);

    assertSuccess(result);
    expect(result.value).toHaveLength(1);
    const candidateIds = result.value[0].candidates.map((c) => c.userId);
    expect(candidateIds).toEqual([activeMemberId]);
    expect(candidateIds).not.toContain(deactivatedMemberId);
  });
});
