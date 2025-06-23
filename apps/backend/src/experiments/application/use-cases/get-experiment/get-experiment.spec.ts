import {
  assertFailure,
  assertSuccess,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { GetExperimentUseCase } from "./get-experiment";

describe("GetExperimentUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetExperimentUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    useCase = testApp.module.get(GetExperimentUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return an experiment when found", async () => {
    // Create an experiment in the database
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      embargoIntervalDays: 90,
      userId: testUserId,
    });

    // Act
    const result = await useCase.execute(experiment.id, testUserId);

    // Assert result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const retrievedExperiment = result.value;
    expect(retrievedExperiment).not.toBeNull();

    // Verify experiment properties
    expect(retrievedExperiment).toMatchObject({
      id: experiment.id,
      name: experiment.name,
      description: experiment.description,
      status: experiment.status,
      visibility: experiment.visibility,
      embargoIntervalDays: experiment.embargoIntervalDays,
      createdBy: testUserId,
    });
  });

  it("should return not found error when experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    // Act
    const result = await useCase.execute(nonExistentId, testUserId);

    // Assert result is failure
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain(
      `Experiment with ID ${nonExistentId} not found`,
    );
  });
});
