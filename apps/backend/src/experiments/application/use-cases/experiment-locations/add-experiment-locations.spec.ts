import { assertFailure, assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { CreateLocationDto } from "../../../core/models/experiment-locations.model";
import { LocationRepository } from "../../../core/repositories/experiment-location.repository";
import { AddExperimentLocationsUseCase } from "./add-experiment-locations";

describe("AddExperimentLocationsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: AddExperimentLocationsUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(AddExperimentLocationsUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should add multiple locations to an experiment", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Add Locations Test Experiment",
      userId: testUserId,
    });

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
    ];

    // Add the locations through the use case
    const result = await useCase.execute(experiment.id, locationsToAdd, testUserId);

    // Verify result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    const locations = result.value;
    expect(Array.isArray(locations)).toBe(true);
    expect(locations.length).toBe(2);

    const locationNames = locations.map((l) => l.name);
    expect(locationNames).toContain("Berlin Office");
    expect(locationNames).toContain("London Office");

    const berlinLocation = locations.find((l) => l.name === "Berlin Office");
    const londonLocation = locations.find((l) => l.name === "London Office");

    expect(berlinLocation?.latitude).toBe("52.52000000");
    expect(berlinLocation?.longitude).toBe("13.40500000");
    expect(berlinLocation?.experimentId).toBe(experiment.id);

    expect(londonLocation?.latitude).toBe("51.50740000");
    expect(londonLocation?.longitude).toBe("-0.12780000");
    expect(londonLocation?.experimentId).toBe(experiment.id);

    // Verify locations have required fields
    locations.forEach((location) => {
      expect(location.id).toBeDefined();
      expect(location.createdAt).toBeDefined();
      expect(location.updatedAt).toBeDefined();
    });
  });

  it("should return empty array when no locations are provided", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Empty Locations Test Experiment",
      userId: testUserId,
    });

    // Add empty locations array
    const result = await useCase.execute(experiment.id, [], testUserId);

    // Verify result is success with empty array
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toEqual([]);
  });

  it("should handle adding locations with precise coordinates", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Precise Coordinates Test Experiment",
      userId: testUserId,
    });

    const preciseLocation: CreateLocationDto = {
      experimentId: experiment.id,
      name: "Precise Location",
      latitude: 52.123456789,
      longitude: 13.987654321,
    };

    const result = await useCase.execute(experiment.id, [preciseLocation], testUserId);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    const location = result.value[0];
    expect(location.name).toBe("Precise Location");
    // Database should handle precision appropriately
    expect(parseFloat(location.latitude)).toBeCloseTo(52.123456789, 8);
    expect(parseFloat(location.longitude)).toBeCloseTo(13.987654321, 8);
  });

  it("should handle user access errors when user has no permission", async () => {
    // Create a test user who will NOT have access
    const anotherUserId = await testApp.createTestUser({});

    // Create an experiment with testUserId (who becomes the creator/admin)
    const { experiment } = await testApp.createExperiment({
      name: "Private Experiment",
      visibility: "private",
      userId: testUserId,
    });

    const locationsToAdd: CreateLocationDto[] = [
      {
        experimentId: experiment.id,
        name: "Unauthorized Location",
        latitude: 52.52,
        longitude: 13.405,
      },
    ];

    // Try to add locations as anotherUserId (who doesn't have access)
    const result = await useCase.execute(experiment.id, locationsToAdd, anotherUserId);

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.message).toContain("You do not have access to this experiment");
  });

  it("should forbid non-admin users from adding locations to archived experiments", async () => {
    // Create a test user who will NOT have admin access
    const anotherUserId = await testApp.createTestUser({});

    // Create an archived experiment with testUserId as the owner/admin
    const { experiment } = await testApp.createExperiment({
      name: "Archived Experiment",
      status: "archived",
      userId: testUserId,
    });

    const locationsToAdd: CreateLocationDto[] = [
      {
        experimentId: experiment.id,
        name: "Unauthorized Archived Location",
        latitude: 52.52,
        longitude: 13.405,
      },
    ];

    // Try to add locations as anotherUserId (non-admin)
    const result = await useCase.execute(experiment.id, locationsToAdd, anotherUserId);

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.message).toContain("Only admins can add locations to archived experiments");
  });

  it("should allow admin users to add locations to archived experiments", async () => {
    // Create an archived experiment where testUserId is the owner/admin
    const { experiment } = await testApp.createExperiment({
      name: "Archived Experiment Admin Add",
      status: "archived",
      userId: testUserId,
    });

    const locationsToAdd: CreateLocationDto[] = [
      {
        experimentId: experiment.id,
        name: "Admin Location",
        latitude: 48.8566,
        longitude: 2.3522,
      },
    ];

    const result = await useCase.execute(experiment.id, locationsToAdd, testUserId);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    const locations = result.value;
    expect(Array.isArray(locations)).toBe(true);
    expect(locations.length).toBe(1);
    expect(locations[0].name).toBe("Admin Location");
    expect(locations[0].experimentId).toBe(experiment.id);
  });

  it("should handle repository errors when creating locations fails", async () => {
    // Arrange
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });

    const locationsToAdd: CreateLocationDto[] = [
      {
        name: "Test Location 1",
        latitude: 40.7128,
        longitude: -74.006,
        experimentId: experiment.id,
      },
    ];

    // Mock the locationRepository.createMany to fail
    const locationRepository = testApp.module.get(LocationRepository);

    vi.spyOn(locationRepository, "createMany").mockResolvedValue(
      failure(AppError.internal("Database connection failed")),
    );

    try {
      // Act
      const result = await useCase.execute(experiment.id, locationsToAdd, testUserId);

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to create locations");
      expect(result.error.message).toContain("Database connection failed");
    } finally {
      // Restore original method
      vi.restoreAllMocks();
    }
  });
});
