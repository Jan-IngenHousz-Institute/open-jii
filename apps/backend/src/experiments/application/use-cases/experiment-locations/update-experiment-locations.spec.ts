import {
  assertFailure,
  assertSuccess,
  failure,
  success,
  AppError,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { CreateLocationDto } from "../../../core/models/experiment-locations.model";
import { LocationRepository } from "../../../core/repositories/experiment-location.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { UpdateExperimentLocationsUseCase } from "./update-experiment-locations";

describe("UpdateExperimentLocationsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: UpdateExperimentLocationsUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(UpdateExperimentLocationsUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should replace all locations for an experiment", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Update Locations Test Experiment",
      userId: testUserId,
    });

    // Add initial locations
    const locationRepository = testApp.module.get(LocationRepository);
    const initialLocations: CreateLocationDto[] = [
      {
        experimentId: experiment.id,
        name: "Initial Location 1",
        latitude: 10.0,
        longitude: 10.0,
      },
      {
        experimentId: experiment.id,
        name: "Initial Location 2",
        latitude: 20.0,
        longitude: 20.0,
      },
    ];

    await locationRepository.createMany(initialLocations);

    // Update with new locations
    const newLocations: CreateLocationDto[] = [
      {
        experimentId: experiment.id,
        name: "New Location 1",
        latitude: 30.0,
        longitude: 30.0,
      },
      {
        experimentId: experiment.id,
        name: "New Location 2",
        latitude: 40.0,
        longitude: 40.0,
      },
      {
        experimentId: experiment.id,
        name: "New Location 3",
        latitude: 50.0,
        longitude: 50.0,
      },
    ];

    const result = await useCase.execute(experiment.id, newLocations, testUserId);

    // Verify result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    const updatedLocations = result.value;
    expect(Array.isArray(updatedLocations)).toBe(true);
    expect(updatedLocations.length).toBe(3);

    const locationNames = updatedLocations.map((l) => l.name).sort();
    expect(locationNames).toEqual(["New Location 1", "New Location 2", "New Location 3"]);

    // Verify old locations are gone
    expect(locationNames).not.toContain("Initial Location 1");
    expect(locationNames).not.toContain("Initial Location 2");

    // Verify all locations have required fields
    updatedLocations.forEach((location) => {
      expect(location.id).toBeDefined();
      expect(location.experimentId).toBe(experiment.id);
      expect(location.name).toBeDefined();
      expect(location.latitude).toBeDefined();
      expect(location.longitude).toBeDefined();
      expect(location.createdAt).toBeDefined();
      expect(location.updatedAt).toBeDefined();
    });
  });

  it("should replace locations with empty array (remove all)", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Remove All Locations Test Experiment",
      userId: testUserId,
    });

    // Add initial locations
    const locationRepository = testApp.module.get(LocationRepository);
    const initialLocations: CreateLocationDto[] = [
      {
        experimentId: experiment.id,
        name: "Location to Remove",
        latitude: 10.0,
        longitude: 10.0,
      },
    ];

    await locationRepository.createMany(initialLocations);

    // Update with empty array
    const result = await useCase.execute(experiment.id, [], testUserId);

    // Verify result is success with empty array
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toEqual([]);

    // Verify locations are actually removed from database
    const getResult = await locationRepository.findByExperimentId(experiment.id);
    expect(getResult.isSuccess()).toBe(true);
    assertSuccess(getResult);
    expect(getResult.value).toEqual([]);
  });

  it("should handle updating experiment with no existing locations", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "No Existing Locations Test Experiment",
      userId: testUserId,
    });

    // Update with new locations (no existing ones)
    const newLocations: CreateLocationDto[] = [
      {
        experimentId: experiment.id,
        name: "First Location",
        latitude: 15.0,
        longitude: 25.0,
      },
    ];

    const result = await useCase.execute(experiment.id, newLocations, testUserId);

    // Verify result is success
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    const locations = result.value;
    expect(locations.length).toBe(1);
    expect(locations[0].name).toBe("First Location");
    expect(locations[0].latitude).toBe("15.00000000");
    expect(locations[0].longitude).toBe("25.00000000");
  });

  it("should handle precise coordinate values", async () => {
    // Create an experiment
    const { experiment } = await testApp.createExperiment({
      name: "Precise Coordinates Test Experiment",
      userId: testUserId,
    });

    const preciseLocations: CreateLocationDto[] = [
      {
        experimentId: experiment.id,
        name: "Precise Location",
        latitude: 52.123456789,
        longitude: 13.987654321,
      },
    ];

    const result = await useCase.execute(experiment.id, preciseLocations, testUserId);

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

    const locationsToUpdate: CreateLocationDto[] = [
      {
        experimentId: experiment.id,
        name: "Unauthorized Location Update",
        latitude: 52.52,
        longitude: 13.405,
      },
    ];

    // Try to update locations as anotherUserId (who doesn't have access)
    const result = await useCase.execute(experiment.id, locationsToUpdate, anotherUserId);

    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    // Implementation changed to return a more specific forbidden message
    expect(result.error.message).toContain("You do not have access to this experiment");
  });

  it("should forbid any user from updating locations of archived experiments", async () => {
    // Create an archived experiment
    const { experiment } = await testApp.createExperiment({
      name: "Archived Experiment",
      userId: testUserId,
    });

    // Mock experimentRepository.checkAccess to return archived experiment
    const experimentRepository = testApp.module.get(ExperimentRepository);
    vi.spyOn(experimentRepository, "checkAccess").mockResolvedValue(
      success({
        experiment: { ...experiment, status: "archived" },
        hasAccess: true,
        hasArchiveAccess: false,
        isAdmin: true,
      }),
    );

    const locationsToUpdate: CreateLocationDto[] = [
      {
        experimentId: experiment.id,
        name: "Attempted Update on Archived",
        latitude: 1.23,
        longitude: 4.56,
      },
    ];

    try {
      const result = await useCase.execute(experiment.id, locationsToUpdate, testUserId);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("You do not have access to this experiment");
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("should not affect locations of other experiments", async () => {
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

    // Update locations for experiment 1 only
    const newLocationsForExp1: CreateLocationDto[] = [
      {
        experimentId: experiment1.id,
        name: "Updated Experiment 1 Location",
        latitude: 15.0,
        longitude: 15.0,
      },
    ];

    const result = await useCase.execute(experiment1.id, newLocationsForExp1, testUserId);
    assertSuccess(result);

    // Verify experiment 1 has updated locations
    expect(result.value.length).toBe(1);
    expect(result.value[0].name).toBe("Updated Experiment 1 Location");

    // Verify experiment 2 locations are unchanged
    const exp2Result = await locationRepository.findByExperimentId(experiment2.id);
    assertSuccess(exp2Result);
    expect(exp2Result.value.length).toBe(1);
    expect(exp2Result.value[0].name).toBe("Experiment 2 Location");
  });

  it("should handle repository errors when replacing locations fails", async () => {
    // Arrange
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });

    const locationsToUpdate: CreateLocationDto[] = [
      {
        name: "Updated Location",
        latitude: 50.0,
        longitude: 50.0,
        experimentId: experiment.id,
      },
    ];

    // Mock the locationRepository.replaceExperimentLocations to fail
    const locationRepository = testApp.module.get(LocationRepository);

    vi.spyOn(locationRepository, "replaceExperimentLocations").mockResolvedValue(
      failure(AppError.internal("Database transaction failed")),
    );

    try {
      // Act
      const result = await useCase.execute(experiment.id, locationsToUpdate, testUserId);

      // Assert
      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to update locations");
      expect(result.error.message).toContain("Database transaction failed");
    } finally {
      // Restore original method
      vi.restoreAllMocks();
    }
  });
});
