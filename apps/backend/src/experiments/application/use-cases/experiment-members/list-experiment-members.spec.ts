import { NotFoundException, ForbiddenException } from "@nestjs/common";

import { TestHarness } from "../../../../test/test-harness";
import { ListExperimentMembersUseCase } from "./list-experiment-members";

describe("ListExperimentMembersUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ListExperimentMembersUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    await testApp.createTestUser();
    useCase = testApp.module.get(ListExperimentMembersUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should list members of an experiment", async () => {
    // Create an experiment
    const experiment = await testApp.createExperiment({
      name: "List Members Test Experiment",
    });

    // Add a member
    const memberId = await testApp.createTestUser("member@example.com");
    await testApp.addExperimentMember(experiment.id, memberId, "member");

    // List members
    const members = await useCase.execute(experiment.id, testApp.testUserId);

    // Verify members are returned
    expect(members).toHaveLength(2); // Creator + added member
    expect(members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: testApp.testUserId,
          role: "admin",
        }),
        expect.objectContaining({
          userId: memberId,
          role: "member",
        }),
      ]),
    );
  });

  it("should throw NotFoundException if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    await expect(
      useCase.execute(nonExistentId, testApp.testUserId),
    ).rejects.toThrow(NotFoundException);
  });

  it("should throw ForbiddenException if user has no access to private experiment", async () => {
    // Create a private experiment
    const experiment = await testApp.createExperiment({
      name: "Private Experiment",
      visibility: "private",
    });

    // Create a user who is not a member
    const nonMemberId = await testApp.createTestUser("nonmember@example.com");

    // Try to list members as non-member
    await expect(useCase.execute(experiment.id, nonMemberId)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("should allow any user to list members of a public experiment", async () => {
    // Create a public experiment
    const experiment = await testApp.createExperiment({
      name: "Public Experiment",
      visibility: "public",
    });

    // Create a user who is not a member
    const nonMemberId = await testApp.createTestUser("nonmember@example.com");

    // List members as non-member
    const members = await useCase.execute(experiment.id, nonMemberId);

    // Verify members are returned
    expect(members).toHaveLength(1); // Just the creator
    expect(members[0]).toMatchObject({
      userId: testApp.testUserId,
      role: "admin",
    });
  });
});
