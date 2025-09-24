import { assertFailure, assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { CreateLocationDto } from "../../../core/models/experiment-locations.model";
import { LocationRepository } from "../../../core/repositories/experiment-location.repository";
import { GetExperimentLocationsUseCase } from "./get-experiment-locations";

describe("GetExperimentLocationsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetExperimentLocationsUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(GetExperimentLocationsUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return empty array when experiment has no locations", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "No Locations Test Experiment",
      userId: testUserId,
    });

    // Get locations for the experiment
    const result = await useCase.execute(experiment.id, testUserId);

    // Verify result is success with empty array
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toEqual([]);
  });

  it("should return all locations for an experiment", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Multiple Locations Test Experiment",
      userId: testUserId,
    });

    // Add locations to the experiment using the repository directly
    const locationRepository = testApp.module.get(LocationRepository);
    const locationsToAdd: CreateLocationDto[] = [
      {
        experimentId: experiment.id,
        name: "Berlin Office",
        latitude: 52.52,
        longitude: 13.405,
      },
      {
        experimentId: experiment.id,
        name: "London Office",
        latitude: 51.5074,
        longitude: -0.1278,
      },
      {
        experimentId: experiment.id,
        name: "Paris Office",
        latitude: 48.8566,
        longitude: 2.3522,
      },
    ];

    await locationRepository.createMany(locationsToAdd);

    // Get locations through the use case
    const result = await useCase.execute(experiment.id, testUserId);

    // Verify result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    const locations = result.value;
    expect(Array.isArray(locations)).toBe(true);
    expect(locations.length).toBe(3);

    const locationNames = locations.map((l) => l.name).sort();
    expect(locationNames).toEqual(["Berlin Office", "London Office", "Paris Office"]);

    // Verify all locations have required fields
    locations.forEach((location) => {
      expect(location.id).toBeDefined();
      expect(location.experimentId).toBe(experiment.id);
      expect(location.name).toBeDefined();
      expect(location.latitude).toBeDefined();
      expect(location.longitude).toBeDefined();
      expect(location.createdAt).toBeDefined();
      expect(location.updatedAt).toBeDefined();
    });

    // Verify specific location details
    const berlinLocation = locations.find((l) => l.name === "Berlin Office");
    expect(berlinLocation?.latitude).toBe("52.52000000");
    expect(berlinLocation?.longitude).toBe("13.40500000");

    const londonLocation = locations.find((l) => l.name === "London Office");
    expect(londonLocation?.latitude).toBe("51.50740000");
    expect(londonLocation?.longitude).toBe("-0.12780000");
  });

  it("should return locations in consistent order", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Ordered Locations Test Experiment",
      userId: testUserId,
    });

    // Add locations in a specific order
    const locationRepository = testApp.module.get(LocationRepository);
    const locationsToAdd: CreateLocationDto[] = [
      {
        experimentId: experiment.id,
        name: "Location C",
        latitude: 30.0,
        longitude: 30.0,
      },
      {
        experimentId: experiment.id,
        name: "Location A",
        latitude: 10.0,
        longitude: 10.0,
      },
      {
        experimentId: experiment.id,
        name: "Location B",
        latitude: 20.0,
        longitude: 20.0,
      },
    ];

    await locationRepository.createMany(locationsToAdd);

    // Get locations multiple times to verify consistent ordering
    const result1 = await useCase.execute(experiment.id, testUserId);
    const result2 = await useCase.execute(experiment.id, testUserId);

    expect(result1.isSuccess()).toBe(true);
    expect(result2.isSuccess()).toBe(true);
    assertSuccess(result1);
    assertSuccess(result2);

    const locations1 = result1.value;
    const locations2 = result2.value;

    // Verify same order is returned each time
    expect(locations1.map((l) => l.name)).toEqual(locations2.map((l) => l.name));
    expect(locations1.length).toBe(3);
  });

  it("should handle database errors gracefully", async () => {
    // Use a non-existent but valid UUID experiment ID
    const nonExistentId = "12345678-1234-1234-1234-123456789012";

    const result = await useCase.execute(nonExistentId, testUserId);

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.message).toContain("Experiment not found");
  });

  it("should not return locations from other experiments", async () => {
    // Create two experiments
    const { experiment: experiment1 } = await testApp.createExperiment({
      name: "Experiment 1",
      userId: testUserId,
    });

    const { experiment: experiment2 } = await testApp.createExperiment({
      name: "Experiment 2",
      userId: testUserId,
    });

    // Add locations to both experiments
    const locationRepository = testApp.module.get(LocationRepository);

    await locationRepository.createMany([
      {
        experimentId: experiment1.id,
        name: "Experiment 1 Location",
        latitude: 10.0,
        longitude: 10.0,
      },
    ]);

    await locationRepository.createMany([
      {
        experimentId: experiment2.id,
        name: "Experiment 2 Location",
        latitude: 20.0,
        longitude: 20.0,
      },
    ]);

    // Get locations for experiment 1
    const result1 = await useCase.execute(experiment1.id, testUserId);
    assertSuccess(result1);
    expect(result1.value.length).toBe(1);
    expect(result1.value[0].name).toBe("Experiment 1 Location");

    // Get locations for experiment 2
    const result2 = await useCase.execute(experiment2.id, testUserId);
    assertSuccess(result2);
    expect(result2.value.length).toBe(1);
    expect(result2.value[0].name).toBe("Experiment 2 Location");
  });

  it("should handle experiment access check failures with invalid experiment ID", async () => {
    // Arrange - use an invalid UUID format that might cause database errors
    const invalidExperimentId = "invalid-experiment-id-format";

    // Act
    const result = await useCase.execute(invalidExperimentId, testUserId);

    // Assert
    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.message).toContain("Experiment not found");
  });

  it("should handle repository errors when fetching locations fails", async () => {
    // Arrange
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });

    // Mock the locationRepository.findByExperimentId to fail
    const locationRepository = testApp.module.get(LocationRepository);

    vi.spyOn(locationRepository, "findByExperimentId").mockResolvedValue(
      failure(AppError.internal("Database query failed")),
    );

    try {
      // Act
      const result = await useCase.execute(experiment.id, testUserId);

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Database query failed");
    } finally {
      // Restore original method
      vi.restoreAllMocks();
    }
  });
});
