import { TestHarness } from "../../../../test/test-harness";
import { ListExperimentsUseCase } from "./list-experiments";

describe("ListExperimentsUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ListExperimentsUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    await testApp.createTestUser();
    useCase = testApp.module.get(ListExperimentsUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should list experiments for a user", async () => {
    // Create experiments
    const experiment1 = await testApp.createExperiment({
      name: "Experiment 1",
    });
    const experiment2 = await testApp.createExperiment({
      name: "Experiment 2",
    });

    // Act
    const result = await useCase.execute(testApp.testUserId);

    // Assert
    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: experiment1.id, name: "Experiment 1" }),
        expect.objectContaining({ id: experiment2.id, name: "Experiment 2" }),
      ]),
    );
  });

  it("should filter experiments by user ownership", async () => {
    // Create an experiment owned by test user
    const ownedExperiment = await testApp.createExperiment({
      name: "My Experiment",
    });

    // Create an experiment with a different user
    const otherUserId = await testApp.createTestUser("other@example.com");
    const originalUserId = testApp.testUserId;
    testApp.testUserId = otherUserId;
    await testApp.createExperiment({
      name: "Other Experiment",
      userId: otherUserId,
    });

    // Reset to original test user
    testApp.testUserId = originalUserId;

    // Act
    const result = await useCase.execute(originalUserId, "my");

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(ownedExperiment.id);
    expect(result[0].name).toBe("My Experiment");
  });

  it("should return empty array when no experiments exist", async () => {
    // Act
    const result = await useCase.execute(testApp.testUserId);

    // Assert
    expect(result).toEqual([]);
  });
});
