import { faker } from "@faker-js/faker";
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unsafe-return */
import { StatusCodes } from "http-status-codes";

import type {
  ErrorResponse,
  LocationList,
  AddExperimentLocationsBody,
  UpdateExperimentLocationsBody,
} from "@repo/api";
import { contract } from "@repo/api";

import { success, failure, AppError } from "../../common/utils/fp-utils";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";
import { GeocodeLocationUseCase } from "../application/use-cases/experiment-locations/geocode-location";
import { SearchPlacesUseCase } from "../application/use-cases/experiment-locations/search-places";
import type { CreateLocationDto } from "../core/models/experiment-locations.model";
import { LocationRepository } from "../core/repositories/experiment-location.repository";

describe("ExperimentLocationsController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    // Reset any mocks before each test
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("getExperimentLocations", () => {
    it("should return all locations of an experiment", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Locations List",
        userId: testUserId,
      });

      // Add locations to the experiment
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
      ];

      await locationRepository.createMany(locationsToAdd);

      // Get the list path
      const path = testApp.resolvePath(contract.experiments.getExperimentLocations.path, {
        id: experiment.id,
      });

      // Request the locations list
      const response: SuperTestResponse<LocationList> = await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      // Assert the response
      expect(response.body).toHaveLength(2);

      // Check that both locations are present with correct structure
      const berlinLocation = response.body.find((loc: any) => loc.name === "Berlin Office");
      const londonLocation = response.body.find((loc: any) => loc.name === "London Office");

      expect(berlinLocation).toBeDefined();
      expect(berlinLocation).toMatchObject({
        name: "Berlin Office",
        latitude: 52.52,
        longitude: 13.405,
      });
      expect(berlinLocation!.id).toBeDefined();
      expect(berlinLocation!.createdAt).toBeDefined();
      expect(berlinLocation!.updatedAt).toBeDefined();

      expect(londonLocation).toBeDefined();
      expect(londonLocation).toMatchObject({
        name: "London Office",
        latitude: 51.5074,
        longitude: -0.1278,
      });
      expect(londonLocation!.id).toBeDefined();
      expect(londonLocation!.createdAt).toBeDefined();
      expect(londonLocation!.updatedAt).toBeDefined();

      // Verify all locations have required fields
      response.body.forEach((location: any) => {
        expect(location.id).toBeDefined();
        expect(location.createdAt).toBeDefined();
        expect(location.updatedAt).toBeDefined();
      });
    });

    it("should return empty array when experiment has no locations", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment with No Locations",
        userId: testUserId,
      });

      // Get the list path
      const path = testApp.resolvePath(contract.experiments.getExperimentLocations.path, {
        id: experiment.id,
      });

      // Request the locations list
      const response: SuperTestResponse<LocationList> = await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      // Assert the response is empty array
      expect(response.body).toEqual([]);
    });

    it("should return 404 if experiment doesn't exist", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(contract.experiments.getExperimentLocations.path, {
        id: nonExistentId,
      });

      await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.NOT_FOUND)
        .expect(({ body }: { body: ErrorResponse }) => {
          expect(body.message).toContain("not found");
        });
    });

    it("should return 400 for invalid experiment UUID", async () => {
      const invalidId = "not-a-uuid";
      const path = testApp.resolvePath(contract.experiments.getExperimentLocations.path, {
        id: invalidId,
      });

      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 if not authenticated", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Locations List",
        userId: testUserId,
      });

      const path = testApp.resolvePath(contract.experiments.getExperimentLocations.path, {
        id: experiment.id,
      });

      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("addExperimentLocations", () => {
    it("should add new locations to an experiment", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Adding Locations",
        userId: testUserId,
      });

      const locationsToAdd: AddExperimentLocationsBody = {
        locations: [
          {
            name: "Berlin Office",
            latitude: 52.52,
            longitude: 13.405,
          },
          {
            name: "Paris Office",
            latitude: 48.8566,
            longitude: 2.3522,
          },
        ],
      };

      const path = testApp.resolvePath(contract.experiments.addExperimentLocations.path, {
        id: experiment.id,
      });

      const response: SuperTestResponse<LocationList> = await testApp
        .post(path)
        .withAuth(testUserId)
        .send(locationsToAdd)
        .expect(StatusCodes.CREATED);

      // Assert the response
      expect(response.body).toHaveLength(2);

      // Check that both locations are present with correct structure
      const berlinLocation = response.body.find((loc: any) => loc.name === "Berlin Office");
      const parisLocation = response.body.find((loc: any) => loc.name === "Paris Office");

      expect(berlinLocation).toBeDefined();
      expect(berlinLocation).toMatchObject({
        name: "Berlin Office",
        latitude: 52.52,
        longitude: 13.405,
      });
      expect(berlinLocation!.id).toBeDefined();
      expect(berlinLocation!.createdAt).toBeDefined();
      expect(berlinLocation!.updatedAt).toBeDefined();

      expect(parisLocation).toBeDefined();
      expect(parisLocation).toMatchObject({
        name: "Paris Office",
        latitude: 48.8566,
        longitude: 2.3522,
      });
      expect(parisLocation!.id).toBeDefined();
      expect(parisLocation!.createdAt).toBeDefined();
      expect(parisLocation!.updatedAt).toBeDefined();

      // Verify all locations have required fields
      response.body.forEach((location) => {
        expect(location.id).toBeDefined();
        expect(location.createdAt).toBeDefined();
        expect(location.updatedAt).toBeDefined();
      });
    });

    it("should handle adding empty locations array", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Empty Locations",
        userId: testUserId,
      });

      const emptyLocations: AddExperimentLocationsBody = {
        locations: [],
      };

      const path = testApp.resolvePath(contract.experiments.addExperimentLocations.path, {
        id: experiment.id,
      });

      const response: SuperTestResponse<LocationList> = await testApp
        .post(path)
        .withAuth(testUserId)
        .send(emptyLocations)
        .expect(StatusCodes.CREATED);

      // Assert the response is empty array
      expect(response.body).toEqual([]);
    });

    it("should return 400 for invalid request body", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Invalid Request",
        userId: testUserId,
      });

      const invalidRequest = {
        locations: [
          {
            name: "Invalid Location",
            // Missing latitude and longitude
          },
        ],
      };

      const path = testApp.resolvePath(contract.experiments.addExperimentLocations.path, {
        id: experiment.id,
      });

      await testApp
        .post(path)
        .withAuth(testUserId)
        .send(invalidRequest)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 404 if experiment doesn't exist", async () => {
      const nonExistentId = faker.string.uuid();
      const validRequest: AddExperimentLocationsBody = {
        locations: [
          {
            name: "Test Location",
            latitude: 52.52,
            longitude: 13.405,
          },
        ],
      };

      const path = testApp.resolvePath(contract.experiments.addExperimentLocations.path, {
        id: nonExistentId,
      });

      await testApp
        .post(path)
        .withAuth(testUserId)
        .send(validRequest)
        .expect(StatusCodes.NOT_FOUND);
    });

    it("should return 401 if not authenticated", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Auth",
        userId: testUserId,
      });

      const validRequest: AddExperimentLocationsBody = {
        locations: [
          {
            name: "Test Location",
            latitude: 52.52,
            longitude: 13.405,
          },
        ],
      };

      const path = testApp.resolvePath(contract.experiments.addExperimentLocations.path, {
        id: experiment.id,
      });

      await testApp.post(path).withoutAuth().send(validRequest).expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("updateExperimentLocations", () => {
    it("should replace all locations for an experiment", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Updating Locations",
        userId: testUserId,
      });

      // Add initial locations
      const locationRepository = testApp.module.get(LocationRepository);
      const initialLocations: CreateLocationDto[] = [
        {
          experimentId: experiment.id,
          name: "Initial Location",
          latitude: 10.0,
          longitude: 10.0,
        },
      ];

      await locationRepository.createMany(initialLocations);

      // Update with new locations
      const newLocations: UpdateExperimentLocationsBody = {
        locations: [
          {
            name: "New Location 1",
            latitude: 30.0,
            longitude: 30.0,
          },
          {
            name: "New Location 2",
            latitude: 40.0,
            longitude: 40.0,
          },
        ],
      };

      const path = testApp.resolvePath(contract.experiments.updateExperimentLocations.path, {
        id: experiment.id,
      });

      const response: SuperTestResponse<LocationList> = await testApp
        .put(path)
        .withAuth(testUserId)
        .send(newLocations)
        .expect(StatusCodes.OK);

      // Assert the response
      expect(response.body).toHaveLength(2);

      // Check that both locations are present with correct structure
      const location1 = response.body.find((loc: any) => loc.name === "New Location 1");
      const location2 = response.body.find((loc: any) => loc.name === "New Location 2");

      expect(location1).toBeDefined();
      expect(location1).toMatchObject({
        name: "New Location 1",
        latitude: 30,
        longitude: 30,
      });
      expect(location1!.id).toBeDefined();
      expect(location1!.createdAt).toBeDefined();
      expect(location1!.updatedAt).toBeDefined();

      expect(location2).toBeDefined();
      expect(location2).toMatchObject({
        name: "New Location 2",
        latitude: 40,
        longitude: 40,
      });
      expect(location2!.id).toBeDefined();
      expect(location2!.createdAt).toBeDefined();
      expect(location2!.updatedAt).toBeDefined();

      // Verify old location is gone
      const locationNames = response.body.map((l: any) => l.name);
      expect(locationNames).not.toContain("Initial Location");
    });

    it("should handle updating to empty locations (remove all)", async () => {
      // Create an experiment
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Removing All Locations",
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
      const emptyLocations: UpdateExperimentLocationsBody = {
        locations: [],
      };

      const path = testApp.resolvePath(contract.experiments.updateExperimentLocations.path, {
        id: experiment.id,
      });

      const response: SuperTestResponse<LocationList> = await testApp
        .put(path)
        .withAuth(testUserId)
        .send(emptyLocations)
        .expect(StatusCodes.OK);

      // Assert the response is empty array
      expect(response.body).toEqual([]);
    });

    it("should return 400 for invalid request body", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Invalid Update",
        userId: testUserId,
      });

      const invalidRequest = {
        locations: [
          {
            name: "Invalid Location",
            latitude: "not-a-number",
            longitude: 13.405,
          },
        ],
      };

      const path = testApp.resolvePath(contract.experiments.updateExperimentLocations.path, {
        id: experiment.id,
      });

      await testApp
        .put(path)
        .withAuth(testUserId)
        .send(invalidRequest)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 404 if experiment doesn't exist", async () => {
      const nonExistentId = faker.string.uuid();
      const validRequest: UpdateExperimentLocationsBody = {
        locations: [
          {
            name: "Test Location",
            latitude: 52.52,
            longitude: 13.405,
          },
        ],
      };

      const path = testApp.resolvePath(contract.experiments.updateExperimentLocations.path, {
        id: nonExistentId,
      });

      await testApp.put(path).withAuth(testUserId).send(validRequest).expect(StatusCodes.NOT_FOUND);
    });

    it("should return 401 if not authenticated", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Auth",
        userId: testUserId,
      });

      const validRequest: UpdateExperimentLocationsBody = {
        locations: [
          {
            name: "Test Location",
            latitude: 52.52,
            longitude: 13.405,
          },
        ],
      };

      const path = testApp.resolvePath(contract.experiments.updateExperimentLocations.path, {
        id: experiment.id,
      });

      await testApp.put(path).withoutAuth().send(validRequest).expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("searchPlaces", () => {
    it("should search for places and return results", async () => {
      const mockSearchResults = [
        {
          label: "New York City, NY, USA",
          latitude: 40.7128,
          longitude: -74.006,
          country: "USA",
          region: "NY",
          municipality: "New York City",
          postalCode: "10001",
        },
        {
          label: "London, UK",
          latitude: 51.5074,
          longitude: -0.1276,
          country: "GBR",
          region: "England",
          municipality: "London",
          postalCode: "E1 6AN",
        },
      ];

      // Mock the search places use case
      const searchPlacesUseCase = testApp.module.get(SearchPlacesUseCase);
      vi.spyOn(searchPlacesUseCase, "execute").mockResolvedValue(success(mockSearchResults));

      const path = "/api/v1/locations/search";

      const response: SuperTestResponse<typeof contract.experiments.searchPlaces> = await testApp
        .get(path)
        .withAuth(testUserId)
        .query({ query: "New York", maxResults: 10 })
        .expect(StatusCodes.OK);

      expect(response.body).toEqual(mockSearchResults);

      expect(response.body).toEqual(mockSearchResults);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(searchPlacesUseCase.execute).toHaveBeenCalledWith({
        query: "New York",
        maxResults: 10,
      });
    });

    it("should return empty array when no places found", async () => {
      const searchPlacesUseCase = testApp.module.get(SearchPlacesUseCase);
      vi.spyOn(searchPlacesUseCase, "execute").mockResolvedValue(success([]));

      const path = "/api/v1/locations/search";

      const response: SuperTestResponse<typeof contract.experiments.searchPlaces> = await testApp
        .get(path)
        .withAuth(testUserId)
        .query({ query: "NonexistentPlace" })
        .expect(StatusCodes.OK);

      expect(response.body).toEqual([]);
    });

    it("should return error when search fails", async () => {
      const searchPlacesUseCase = testApp.module.get(SearchPlacesUseCase);
      vi.spyOn(searchPlacesUseCase, "execute").mockResolvedValue(
        failure(AppError.internal("Search failed")),
      );

      const path = "/api/v1/locations/search";

      const response: SuperTestResponse<ErrorResponse> = await testApp
        .get(path)
        .withAuth(testUserId)
        .query({ query: "test" })
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);

      expect(response.body.message).toBe("Search failed");
    });

    it("should require authentication", async () => {
      const path = "/api/v1/locations/search";

      await testApp
        .get(path)
        .withoutAuth()
        .query({ query: "test" })
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("geocodeLocation", () => {
    it("should geocode coordinates and return place information", async () => {
      const mockGeocodeResults = [
        {
          label: "123 Main St, New York, NY 10001, USA",
          latitude: 40.7128,
          longitude: -74.006,
          country: "USA",
          region: "NY",
          municipality: "New York",
          postalCode: "10001",
        },
      ];

      // Mock the geocode location use case
      const geocodeLocationUseCase = testApp.module.get(GeocodeLocationUseCase);
      vi.spyOn(geocodeLocationUseCase, "execute").mockResolvedValue(success(mockGeocodeResults));

      const path = "/api/v1/locations/geocode";

      const response: SuperTestResponse<typeof contract.experiments.geocodeLocation> = await testApp
        .get(path)
        .withAuth(testUserId)
        .query({ latitude: 40.7128, longitude: -74.006 })
        .expect(StatusCodes.OK);

      expect(response.body).toEqual(mockGeocodeResults);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(geocodeLocationUseCase.execute).toHaveBeenCalledWith({
        latitude: 40.7128,
        longitude: -74.006,
      });
    });

    it("should return empty array when no places found for coordinates", async () => {
      const geocodeLocationUseCase = testApp.module.get(GeocodeLocationUseCase);
      vi.spyOn(geocodeLocationUseCase, "execute").mockResolvedValue(success([]));

      const path = "/api/v1/locations/geocode";

      const response: SuperTestResponse<typeof contract.experiments.geocodeLocation> = await testApp
        .get(path)
        .withAuth(testUserId)
        .query({ latitude: 0, longitude: 0 })
        .expect(StatusCodes.OK);

      expect(response.body).toEqual([]);
    });

    it("should return error when geocoding fails", async () => {
      const geocodeLocationUseCase = testApp.module.get(GeocodeLocationUseCase);
      vi.spyOn(geocodeLocationUseCase, "execute").mockResolvedValue(
        failure(AppError.internal("Geocoding failed")),
      );

      const path = "/api/v1/locations/geocode";

      const response: SuperTestResponse<ErrorResponse> = await testApp
        .get(path)
        .withAuth(testUserId)
        .query({ latitude: 40.7128, longitude: -74.006 })
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);

      expect(response.body.message).toBe("Geocoding failed");
    });

    it("should handle edge case coordinates", async () => {
      const mockGeocodeResults = [
        {
          label: "Antarctica",
          latitude: -90,
          longitude: 0,
          country: "Antarctica",
        },
      ];

      const geocodeLocationUseCase = testApp.module.get(GeocodeLocationUseCase);
      vi.spyOn(geocodeLocationUseCase, "execute").mockResolvedValue(success(mockGeocodeResults));

      const path = "/api/v1/locations/geocode";

      const response: SuperTestResponse<typeof contract.experiments.geocodeLocation> = await testApp
        .get(path)
        .withAuth(testUserId)
        .query({ latitude: -90, longitude: 0 })
        .expect(StatusCodes.OK);

      expect(response.body).toEqual(mockGeocodeResults);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(geocodeLocationUseCase.execute).toHaveBeenCalledWith({
        latitude: -90,
        longitude: 0,
      });
    });

    it("should require authentication", async () => {
      const path = "/api/v1/locations/geocode";

      await testApp
        .get(path)
        .withoutAuth()
        .query({ latitude: "40.7128", longitude: "-74.006" })
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });
});
