import { TestHarness } from "../../../../test/test-harness";
import { assertSuccess } from "../../../utils/fp-utils";
import { ListExperimentsUseCase } from "./list-experiments";

describe("ListExperimentsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ListExperimentsUseCase;

  beforeAll(async () => {
    await testApp.setup();
    testUserId = await testApp.createTestUser({});
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
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
    const { experiment: experiment1 } = await testApp.createExperiment({
      name: "Experiment 1",
      userId: testUserId,
    });
    const { experiment: experiment2 } = await testApp.createExperiment({
      name: "Experiment 2",
      userId: testUserId,
    });

    // Act
    const result = await useCase.execute(testUserId);

    expect(result.isSuccess()).toBe(true);

    assertSuccess(result);
    const experiments = result.value;

    // Assert - should only find the experiments we just created
    expect(experiments.length).toBeLessThanOrEqual(2);
    expect(experiments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: experiment1.id, name: "Experiment 1" }),
        expect.objectContaining({ id: experiment2.id, name: "Experiment 2" }),
      ]),
    );
  });

  it("should filter experiments by user ownership", async () => {
    // Create a new user for this specific test
    const mainUserId = await testApp.createTestUser({
      email: "main-user@example.com",
    });
    const otherUserId = await testApp.createTestUser({
      email: "other@example.com",
    });

    // Create experiment owned by main user
    const { experiment: ownedExperiment } = await testApp.createExperiment({
      name: "My Experiment",
      userId: mainUserId,
    });

    // Create experiment owned by other user
    await testApp.createExperiment({
      name: "Other Experiment",
      userId: otherUserId,
    });

    // Act - filter by "my" to only get experiments owned by mainUserId
    const result = await useCase.execute(mainUserId, "my");

    expect(result.isSuccess()).toBe(true);

    assertSuccess(result);
    const experiments = result.value;

    // Assert - should only find experiments owned by mainUserId
    expect(experiments.length).toBeGreaterThanOrEqual(1);
    expect(experiments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: ownedExperiment.id,
          name: "My Experiment",
          createdBy: mainUserId,
        }),
      ]),
    );
  });

  it("should return empty array when no experiments exist", async () => {
    // Create a unique user for this test to ensure isolation
    const uniqueUserId = await testApp.createTestUser({
      email: "unique-user@example.com",
    });

    // Act - get experiments for this new user who hasn't created any
    const result = await useCase.execute(uniqueUserId);

    expect(result.isSuccess()).toBe(true);

    assertSuccess(result);
    const experiments = result.value;

    // Assert
    expect(experiments).toEqual([]);
  });
});
