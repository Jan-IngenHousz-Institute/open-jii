import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
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

  it("should filter experiments by status", async () => {
    // Create a user for this test
    const userId = await testApp.createTestUser({
      email: "status-test@example.com",
    });

    // Create active experiment
    const { experiment: activeExperiment } = await testApp.createExperiment({
      name: "Active Experiment",
      userId,
      status: "active",
    });

    // Create archived experiment
    await testApp.createExperiment({
      name: "Archived Experiment",
      userId,
      status: "archived",
    });

    // Act - filter by "active" status
    const result = await useCase.execute(userId, undefined, "active");

    expect(result.isSuccess()).toBe(true);

    assertSuccess(result);
    const experiments = result.value;

    // Assert - should only find experiments with active status
    expect(experiments.length).toBe(1);
    expect(experiments[0].id).toBe(activeExperiment.id);
    expect(experiments[0].name).toBe("Active Experiment");
    expect(experiments[0].status).toBe("active");
  });

  it("should combine relationship and status filters", async () => {
    // Create users for this test
    const mainUserId = await testApp.createTestUser({
      email: "main-combo@example.com",
    });
    const otherUserId = await testApp.createTestUser({
      email: "other-combo@example.com",
    });

    // Create active experiment owned by main user
    const { experiment: myActive } = await testApp.createExperiment({
      name: "My Active Experiment",
      userId: mainUserId,
      status: "active",
    });

    // Create archived experiment owned by main user
    await testApp.createExperiment({
      name: "My Archived Experiment",
      userId: mainUserId,
      status: "archived",
    });

    // Create active experiment owned by other user
    await testApp.createExperiment({
      name: "Other Active Experiment",
      userId: otherUserId,
      status: "active",
    });

    // Act - filter by "my" and "active" status
    const result = await useCase.execute(mainUserId, "my", "active");

    expect(result.isSuccess()).toBe(true);

    assertSuccess(result);
    const experiments = result.value;

    // Assert - should only find active experiments owned by mainUserId
    expect(experiments.length).toBe(1);
    expect(experiments[0].id).toBe(myActive.id);
    expect(experiments[0].name).toBe("My Active Experiment");
    expect(experiments[0].status).toBe("active");
    expect(experiments[0].createdBy).toBe(mainUserId);
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

  it("should filter experiments by search term in name", async () => {
    // Arrange
    const userId = await testApp.createTestUser({ email: "search-usecase@example.com" });
    await testApp.createExperiment({ name: "Alpha Experiment", userId });
    await testApp.createExperiment({ name: "Beta Experiment", userId });
    await testApp.createExperiment({ name: "Gamma", userId });

    // Act
    const result = await useCase.execute(userId, undefined, undefined, "Experiment");

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const experiments = result.value;
    expect(experiments.length).toBe(2);
    expect(experiments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Alpha Experiment" }),
        expect.objectContaining({ name: "Beta Experiment" }),
      ]),
    );
    expect(experiments.some((e) => e.name === "Gamma")).toBe(false);
  });

  it("should filter experiments by search term, relationship, and status together", async () => {
    // Arrange
    const mainUserId = await testApp.createTestUser({ email: "search-rel-status@example.com" });
    const otherUserId = await testApp.createTestUser({
      email: "search-rel-status-other@example.com",
    });

    // Create experiments with unique names
    await testApp.createExperiment({
      name: "My Searchable Active",
      userId: mainUserId,
      status: "active",
    });
    await testApp.createExperiment({
      name: "My Searchable Archived",
      userId: mainUserId,
      status: "archived",
    });
    await testApp.createExperiment({ name: "My Unrelated", userId: mainUserId, status: "active" });
    const { experiment: memberExpActive } = await testApp.createExperiment({
      name: "Member Searchable Active",
      userId: otherUserId,
      status: "active",
    });
    const { experiment: memberExpArchived } = await testApp.createExperiment({
      name: "Member Searchable Archived",
      userId: otherUserId,
      status: "archived",
    });
    await testApp.addExperimentMember(memberExpActive.id, mainUserId, "member");
    await testApp.addExperimentMember(memberExpArchived.id, mainUserId, "member");
    await testApp.createExperiment({
      name: "Other Experiment",
      userId: otherUserId,
      status: "active",
    });

    // Act
    const result = await useCase.execute(mainUserId, "related", "active", "Searchable");

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const experiments = result.value;
    // Should only return 'My Searchable Active' and 'Member Searchable Active' with status 'active'
    expect(experiments.length).toBe(2);
    expect(experiments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "My Searchable Active", status: "active" }),
        expect.objectContaining({ name: "Member Searchable Active", status: "active" }),
      ]),
    );
    // Should not return archived or unrelated experiments
    expect(
      experiments.some(
        (e) =>
          e.status === "archived" || e.name === "My Unrelated" || e.name === "Other Experiment",
      ),
    ).toBe(false);
  });
});
