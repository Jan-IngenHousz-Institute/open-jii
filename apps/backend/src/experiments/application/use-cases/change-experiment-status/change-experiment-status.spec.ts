import { TestHarness } from "../../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../../utils/fp-utils";
import { ChangeExperimentStatusUseCase } from "./change-experiment-status";

describe("ChangeExperimentStatusUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ChangeExperimentStatusUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ChangeExperimentStatusUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should change experiment status successfully", async () => {
    // Create an experiment with initial status 'provisioning'
    const { experiment } = await testApp.createExperiment({
      name: "Status Change Test",
      status: "provisioning",
      userId: testUserId,
    });

    // Change the status to 'active'
    const result = await useCase.execute(experiment.id, "active");

    expect(result.isSuccess()).toBe(true);

    assertSuccess(result);
    const updatedExperiment = result.value;
    expect(updatedExperiment).not.toBeNull();

    // Verify the status was updated
    expect(updatedExperiment).toMatchObject({
      id: experiment.id,
      status: "active",
    });
  });

  it("should return NOT_FOUND error if experiment does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    // Try to update a non-existent experiment
    const result = await useCase.execute(nonExistentId, "active");

    expect(result.isSuccess()).toBe(false);
    expect(result._tag).toBe("failure");

    // Use the assertion function for cleaner tests
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return BAD_REQUEST error for invalid status", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Invalid Status Test",
      userId: testUserId,
    });

    // @ts-expect-error - Testing invalid status
    const result = await useCase.execute(experiment.id, "invalid_status");

    expect(result.isSuccess()).toBe(false);
    expect(result._tag).toBe("failure");

    // Use the assertion function for cleaner tests
    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
  });

  it("should support all valid status transitions", async () => {
    // Create an experiment with initial status 'provisioning'
    const { experiment } = await testApp.createExperiment({
      name: "All Status Transitions Test",
      status: "provisioning",
      userId: testUserId,
    });

    // Change to active
    let result = await useCase.execute(experiment.id, "active");
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    let updatedExperiment = result.value;
    expect(updatedExperiment.status).toBe("active");

    // Change to archived
    result = await useCase.execute(experiment.id, "archived");
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    updatedExperiment = result.value;
    expect(updatedExperiment.status).toBe("archived");

    // Change back to active
    result = await useCase.execute(experiment.id, "active");
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    updatedExperiment = result.value;
    expect(updatedExperiment.status).toBe("active");

    // Change back to provisioning
    result = await useCase.execute(experiment.id, "provisioning");
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    updatedExperiment = result.value;
    expect(updatedExperiment.status).toBe("provisioning");
  });
});
