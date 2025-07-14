import { assertFailure } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { RemoveExperimentProtocolUseCase } from "./remove-experiment-protocol";

describe("RemoveExperimentProtocolUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: RemoveExperimentProtocolUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(RemoveExperimentProtocolUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should allow admin to remove a protocol", async () => {
    // Create an experiment (creator is admin)
    const { experiment } = await testApp.createExperiment({
      name: "Remove Protocol Test Experiment",
      userId: testUserId,
    });

    // Create a protocol and associate it
    const protocol = await testApp.createProtocol({
      name: "Test Protocol",
      createdBy: testUserId,
    });
    await testApp.addExperimentProtocol(experiment.id, protocol.id);

    // Remove the protocol as admin
    const result = await useCase.execute(experiment.id, protocol.id, testUserId);
    expect(result.isSuccess()).toBe(true);
  });

  it("should return NOT_FOUND error if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const protocol = await testApp.createProtocol({
      name: "Nonexistent Protocol",
      createdBy: testUserId,
    });
    const result = await useCase.execute(nonExistentId, protocol.id, testUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return FORBIDDEN error if user is not an admin", async () => {
    // Create experiment and admin
    const { experiment } = await testApp.createExperiment({
      name: "Forbidden Protocol Remove Test",
      userId: testUserId,
    });
    // Create a regular user
    const regularUserId = await testApp.createTestUser({ email: "regular@example.com" });
    // Create and associate protocol
    const protocol = await testApp.createProtocol({
      name: "Test Protocol",
      createdBy: testUserId,
    });
    await testApp.addExperimentProtocol(experiment.id, protocol.id);
    // Try to remove as non-admin
    const result = await useCase.execute(experiment.id, protocol.id, regularUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("should return NOT_FOUND error if protocol is not associated", async () => {
    // Create experiment and admin
    const { experiment } = await testApp.createExperiment({
      name: "Protocol Not Found Test",
      userId: testUserId,
    });
    // Create a protocol but do not associate
    const protocol = await testApp.createProtocol({
      name: "Unlinked Protocol",
      createdBy: testUserId,
    });
    // Try to remove unassociated protocol
    const result = await useCase.execute(experiment.id, protocol.id, testUserId);
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });
});
