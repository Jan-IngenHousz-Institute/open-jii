import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { CreateLocationDto } from "../models/experiment-locations.model";
import { LocationRepository } from "./experiment-location.repository";

describe("LocationRepository", () => {
  const testApp = TestHarness.App;
  let repository: LocationRepository;
  let testUserId: string;
  let experimentId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    repository = testApp.module.get(LocationRepository);

    // Create test experiment
    const { experiment } = await testApp.createExperiment({
      name: "Location Test Experiment",
      userId: testUserId,
    });
    experimentId = experiment.id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("findByExperimentId", () => {
    it("should return empty array when experiment has no locations", async () => {
      // Act
      const result = await repository.findByExperimentId(experimentId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([]);
    });

    it("should return all locations for an experiment", async () => {
      // Arrange
      const locationsToCreate: CreateLocationDto[] = [
        {
          experimentId,
          name: "Berlin Office",
          latitude: 52.52,
          longitude: 13.405,
          country: "Germany",
          region: "Berlin",
          municipality: "Berlin",
          postalCode: "10117",
          addressLabel: "Brandenburg Gate, Pariser Platz, Berlin, Germany",
        },
        {
          experimentId,
          name: "London Office",
          latitude: 51.5074,
          longitude: -0.1278,
          country: "United Kingdom",
          region: "England",
          municipality: "London",
          postalCode: "SW1A 1AA",
        },
      ];

      await repository.createMany(locationsToCreate);

      // Act
      const result = await repository.findByExperimentId(experimentId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const locations = result.value;

      expect(locations).toHaveLength(2);
      expect(locations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "Berlin Office",
            latitude: "52.52000000",
            longitude: "13.40500000",
            country: "Germany",
            region: "Berlin",
            municipality: "Berlin",
            postalCode: "10117",
            addressLabel: "Brandenburg Gate, Pariser Platz, Berlin, Germany",
            experimentId,
          }),
          expect.objectContaining({
            name: "London Office",
            latitude: "51.50740000",
            longitude: "-0.12780000",
            country: "United Kingdom",
            region: "England",
            municipality: "London",
            postalCode: "SW1A 1AA",
            addressLabel: null, // This one doesn't have addressLabel set
            experimentId,
          }),
        ]),
      );

      // Check that each location has required fields
      locations.forEach((location) => {
        expect(location.id).toBeDefined();
        expect(location.createdAt).toBeDefined();
        expect(location.updatedAt).toBeDefined();
      });
    });

    it("should return empty array for non-existent experiment", async () => {
      // Act
      const result = await repository.findByExperimentId("12345678-1234-1234-1234-123456789012");

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([]);
    });
  });

  describe("create", () => {
    it("should create a single location successfully", async () => {
      // Arrange
      const locationToCreate: CreateLocationDto = {
        experimentId,
        name: "Test Location",
        latitude: 40.7128,
        longitude: -74.006,
        country: "United States",
        region: "New York",
        municipality: "New York",
        postalCode: "10001",
      };

      // Act
      const result = await repository.create(locationToCreate);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const locations = result.value;

      expect(locations).toHaveLength(1);
      const location = locations[0];
      expect(location).toMatchObject({
        name: "Test Location",
        latitude: "40.71280000",
        longitude: "-74.00600000",
        country: "United States",
        region: "New York",
        municipality: "New York",
        postalCode: "10001",
        addressLabel: null,
        experimentId,
      });
      expect(location.id).toBeDefined();
      expect(location.createdAt).toBeDefined();
      expect(location.updatedAt).toBeDefined();
    });

    it("should handle coordinate precision correctly", async () => {
      // Arrange
      const locationToCreate: CreateLocationDto = {
        experimentId,
        name: "Precise Location",
        latitude: 52.123456789,
        longitude: 13.987654321,
      };

      // Act
      const result = await repository.create(locationToCreate);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const location = result.value[0];

      // Should handle decimal precision appropriately
      expect(parseFloat(location.latitude)).toBeCloseTo(52.123456789, 8);
      expect(parseFloat(location.longitude)).toBeCloseTo(13.987654321, 8);
    });
  });

  describe("createMany", () => {
    it("should create multiple locations successfully", async () => {
      // Arrange
      const locationsToCreate: CreateLocationDto[] = [
        {
          experimentId,
          name: "Location 1",
          latitude: 52.52,
          longitude: 13.405,
        },
        {
          experimentId,
          name: "Location 2",
          latitude: 51.5074,
          longitude: -0.1278,
        },
        {
          experimentId,
          name: "Location 3",
          latitude: 48.8566,
          longitude: 2.3522,
        },
      ];

      // Act
      const result = await repository.createMany(locationsToCreate);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const locations = result.value;

      expect(locations).toHaveLength(3);
      expect(locations.map((l) => l.name)).toEqual(["Location 1", "Location 2", "Location 3"]);

      // Verify all locations belong to the same experiment
      locations.forEach((location) => {
        expect(location.experimentId).toBe(experimentId);
      });
    });

    it("should handle empty array", async () => {
      // Act
      const result = await repository.createMany([]);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([]);
    });
  });

  describe("removeAllFromExperiment", () => {
    it("should remove all locations from an experiment", async () => {
      // Arrange - create some locations first
      const locationsToCreate: CreateLocationDto[] = [
        {
          experimentId,
          name: "Location 1",
          latitude: 52.52,
          longitude: 13.405,
        },
        {
          experimentId,
          name: "Location 2",
          latitude: 51.5074,
          longitude: -0.1278,
        },
      ];

      await repository.createMany(locationsToCreate);

      // Verify locations exist
      const beforeResult = await repository.findByExperimentId(experimentId);
      assertSuccess(beforeResult);
      expect(beforeResult.value).toHaveLength(2);

      // Act
      const result = await repository.removeAllFromExperiment(experimentId);

      // Assert
      expect(result.isSuccess()).toBe(true);

      // Verify locations are removed
      const afterResult = await repository.findByExperimentId(experimentId);
      assertSuccess(afterResult);
      expect(afterResult.value).toEqual([]);
    });

    it("should succeed even if experiment has no locations", async () => {
      // Act
      const result = await repository.removeAllFromExperiment(experimentId);

      // Assert
      expect(result.isSuccess()).toBe(true);
    });
  });

  describe("replaceExperimentLocations", () => {
    it("should replace all locations with new ones", async () => {
      // Arrange - create initial locations
      const initialLocations: CreateLocationDto[] = [
        {
          experimentId,
          name: "Old Location 1",
          latitude: 52.52,
          longitude: 13.405,
        },
        {
          experimentId,
          name: "Old Location 2",
          latitude: 51.5074,
          longitude: -0.1278,
        },
      ];

      await repository.createMany(initialLocations);

      const newLocations: CreateLocationDto[] = [
        {
          experimentId,
          name: "New Location 1",
          latitude: 48.8566,
          longitude: 2.3522,
        },
      ];

      // Act
      const result = await repository.replaceExperimentLocations(experimentId, newLocations);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const replacedLocations = result.value;

      expect(replacedLocations).toHaveLength(1);
      expect(replacedLocations[0].name).toBe("New Location 1");

      // Verify old locations are gone and only new ones remain
      const allLocationsResult = await repository.findByExperimentId(experimentId);
      assertSuccess(allLocationsResult);
      expect(allLocationsResult.value).toHaveLength(1);
      expect(allLocationsResult.value[0].name).toBe("New Location 1");
    });

    it("should remove all locations when empty array is provided", async () => {
      // Arrange - create initial locations
      const initialLocations: CreateLocationDto[] = [
        {
          experimentId,
          name: "Location to Remove",
          latitude: 52.52,
          longitude: 13.405,
        },
      ];

      await repository.createMany(initialLocations);

      // Act
      const result = await repository.replaceExperimentLocations(experimentId, []);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([]);

      // Verify all locations are removed
      const allLocationsResult = await repository.findByExperimentId(experimentId);
      assertSuccess(allLocationsResult);
      expect(allLocationsResult.value).toEqual([]);
    });

    it("should work when experiment initially has no locations", async () => {
      // Arrange
      const newLocations: CreateLocationDto[] = [
        {
          experimentId,
          name: "First Location",
          latitude: 52.52,
          longitude: 13.405,
        },
      ];

      // Act
      const result = await repository.replaceExperimentLocations(experimentId, newLocations);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const locations = result.value;

      expect(locations).toHaveLength(1);
      expect(locations[0].name).toBe("First Location");
    });
  });
});
