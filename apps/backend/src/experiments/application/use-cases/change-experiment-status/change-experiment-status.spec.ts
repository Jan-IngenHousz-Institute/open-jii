import { BadRequestException, NotFoundException } from "@nestjs/common";

import { TestHarness } from "../../../../test/test-harness";
import {
  ChangeExperimentStatusUseCase,
  ExperimentStatus,
} from "./change-experiment-status";

describe("ChangeExperimentStatusUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ChangeExperimentStatusUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    await testApp.createTestUser();
    useCase = testApp.module.get(ChangeExperimentStatusUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should change the status of an experiment", async () => {
    // Create an experiment with initial status
    const experiment = await testApp.createExperiment({
      name: "Status Test Experiment",
      status: "provisioning",
    });

    // Change the status
    const updatedExperiment = await useCase.execute(experiment.id, "active");

    // Verify the status was changed
    expect(updatedExperiment).toMatchObject({
      id: experiment.id,
      status: "active",
    });
  });

  it("should throw NotFoundException if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    await expect(useCase.execute(nonExistentId, "active")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("should throw BadRequestException for invalid status", async () => {
    // Create an experiment
    const experiment = await testApp.createExperiment({
      name: "Invalid Status Test",
    });

    // Try to change to an invalid status
    await expect(
      useCase.execute(experiment.id, "invalid" as ExperimentStatus),
    ).rejects.toThrow(BadRequestException);
  });
});
