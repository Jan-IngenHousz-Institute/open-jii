import { NotFoundException, ForbiddenException } from "@nestjs/common";

import { TestHarness } from "../../../../test/test-harness";
import { RemoveExperimentMemberUseCase } from "./remove-experiment-member";

describe("RemoveExperimentMemberUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: RemoveExperimentMemberUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    await testApp.createTestUser();
    useCase = testApp.module.get(RemoveExperimentMemberUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should allow admin to remove a member", async () => {
    // Create an experiment
    const experiment = await testApp.createExperiment({
      name: "Remove Member Test Experiment",
    });

    // Add a regular member
    const memberId = await testApp.createTestUser("member@example.com");
    await testApp.addExperimentMember(experiment.id, memberId, "member");

    // Remove the member as admin
    await useCase.execute(experiment.id, memberId, testApp.testUserId);

    // No need for assertion as the lack of exception indicates success
  });

  it("should throw NotFoundException if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const memberId = await testApp.createTestUser("nonexistent@example.com");

    await expect(
      useCase.execute(nonExistentId, memberId, testApp.testUserId),
    ).rejects.toThrow(NotFoundException);
  });

  it("should throw ForbiddenException if user is not an admin", async () => {
    // Create an experiment
    const experiment = await testApp.createExperiment({
      name: "Forbidden Test Experiment",
    });

    // Create a regular user
    const regularUserId = await testApp.createTestUser("regular@example.com");
    // Add a member to remove
    const memberId = await testApp.createTestUser("member@example.com");
    await testApp.addExperimentMember(experiment.id, memberId, "member");

    // Try to remove a member as a non-admin user
    await expect(
      useCase.execute(experiment.id, memberId, regularUserId),
    ).rejects.toThrow(ForbiddenException);
  });

  it("should throw NotFoundException if member does not exist", async () => {
    // Create an experiment
    const experiment = await testApp.createExperiment({
      name: "Member Not Found Test",
    });

    // Try to remove a non-existent member
    const nonExistentMemberId = "00000000-0000-0000-0000-000000000000";

    await expect(
      useCase.execute(experiment.id, nonExistentMemberId, testApp.testUserId),
    ).rejects.toThrow(NotFoundException);
  });
});
