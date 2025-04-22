import { NotFoundException, ForbiddenException } from "@nestjs/common";

import { TestHarness } from "../../../../test/test-harness";
import { AddExperimentMemberUseCase } from "./add-experiment-member";

describe("AddExperimentMemberUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: AddExperimentMemberUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    await testApp.createTestUser();
    useCase = testApp.module.get(AddExperimentMemberUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should add a member to an experiment", async () => {
    // Create an experiment
    const experiment = await testApp.createExperiment({
      name: "Add Member Test Experiment",
    });

    // Create a new user to add as a member
    const newMemberId = await testApp.createTestUser("newmember@example.com");

    // Add the member
    const result = await useCase.execute(
      experiment.id,
      { userId: newMemberId, role: "member" },
      testApp.testUserId,
    );

    // Verify the member was added
    expect(result).toMatchObject({
      experimentId: experiment.id,
      userId: newMemberId,
      role: "member",
    });
  });

  it("should throw NotFoundException if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const newMemberId = await testApp.createTestUser("nonexistent@example.com");

    await expect(
      useCase.execute(
        nonExistentId,
        { userId: newMemberId },
        testApp.testUserId,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("should throw ForbiddenException if user is not an admin", async () => {
    // Create an experiment
    const experiment = await testApp.createExperiment({
      name: "Forbidden Test Experiment",
    });

    // Create a non-admin user
    const nonAdminId = await testApp.createTestUser("nonadmin@example.com");
    const newMemberId = await testApp.createTestUser("newmember2@example.com");

    // Try to add a member as a non-admin user
    await expect(
      useCase.execute(experiment.id, { userId: newMemberId }, nonAdminId),
    ).rejects.toThrow(ForbiddenException);
  });
});
