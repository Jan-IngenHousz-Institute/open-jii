import { NotFoundException } from "@nestjs/common";

import { TestHarness } from "../../../../test/test-harness";
import { GetExperimentUseCase } from "./get-experiment";

describe("GetExperimentUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetExperimentUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    await testApp.createTestUser();
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
    const experiment = await testApp.createExperiment({
      name: "Test Experiment",
      description: "Test Description",
      status: "active",
      visibility: "private",
      embargoIntervalDays: 90,
    });

    // Act
    const result = await useCase.execute(experiment.id);

    // Assert
    expect(result).toMatchObject({
      id: experiment.id,
      name: experiment.name,
      description: experiment.description,
      status: experiment.status,
      visibility: experiment.visibility,
      embargoIntervalDays: experiment.embargoIntervalDays,
      createdBy: testApp.testUserId,
    });
  });

  it("should throw NotFoundException when experiment is not found", async () => {
    // Act & Assert
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    await expect(useCase.execute(nonExistentId)).rejects.toThrow(
      NotFoundException,
    );
  });
});
