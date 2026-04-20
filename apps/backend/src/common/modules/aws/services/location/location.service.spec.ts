import {
  LocationClient,
  SearchPlaceIndexForSuggestionsCommand,
  GetPlaceCommand,
  SearchPlaceIndexForPositionCommand,
} from "@aws-sdk/client-location";
import { mockClient } from "aws-sdk-client-mock";

import { TestHarness } from "../../../../../test/test-harness";
import { AwsLocationService } from "./location.service";

const locationMock = mockClient(LocationClient);

describe("AwsLocationService", () => {
  const testApp = TestHarness.App;
  let service: AwsLocationService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    locationMock.reset();
    await testApp.beforeEach();
    service = testApp.module.get(AwsLocationService);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("searchPlaces", () => {
    it("should search for places and return formatted results", async () => {
      const mockSuggestionsResponse = {
        Results: [
          {
            PlaceId: "place-1",
            Text: "New York, NY, USA",
          },
          {
            PlaceId: "place-2",
            Text: "London, UK",
          },
        ],
      };

      const mockPlaceResponse1 = {
        Place: {
          Label: "New York, NY, USA",
          Geometry: {
            Point: [-74.006, 40.7128],
          },
          Country: "USA",
          Region: "NY",
          Municipality: "New York",
          PostalCode: "10001",
        },
      };

      const mockPlaceResponse2 = {
        Place: {
          Label: "London, UK",
          Geometry: {
            Point: [-0.1276, 51.5074],
          },
          Country: "GBR",
          Region: "England",
          Municipality: "London",
          PostalCode: "E1 6AN",
        },
      };

      locationMock
        .on(SearchPlaceIndexForSuggestionsCommand)
        .resolves(mockSuggestionsResponse);
      locationMock
        .on(GetPlaceCommand)
        .resolvesOnce(mockPlaceResponse1)
        .resolvesOnce(mockPlaceResponse2);

      const result = await service.searchPlaces({
        query: "New York",
        maxResults: 10,
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        label: "New York, NY, USA",
        latitude: 40.7128,
        longitude: -74.006,
        country: "USA",
        region: "NY",
        municipality: "New York",
        postalCode: "10001",
      });
      expect(result[1]).toEqual({
        label: "London, UK",
        latitude: 51.5074,
        longitude: -0.1276,
        country: "GBR",
        region: "England",
        municipality: "London",
        postalCode: "E1 6AN",
      });
      expect(
        locationMock.commandCalls(SearchPlaceIndexForSuggestionsCommand),
      ).toHaveLength(1);
      expect(locationMock.commandCalls(GetPlaceCommand)).toHaveLength(2);
    });

    it("should handle empty results", async () => {
      locationMock
        .on(SearchPlaceIndexForSuggestionsCommand)
        .resolves({ Results: [] });

      const result = await service.searchPlaces({
        query: "NonexistentPlace12345",
        maxResults: 5,
      });

      expect(result).toEqual([]);
      expect(
        locationMock.commandCalls(SearchPlaceIndexForSuggestionsCommand),
      ).toHaveLength(1);
    });

    it("should handle results with missing geometry", async () => {
      locationMock.on(SearchPlaceIndexForSuggestionsCommand).resolves({
        Results: [
          { PlaceId: "place-1", Text: "Invalid Place" },
          { PlaceId: "place-2", Text: "Valid Place" },
        ],
      });

      locationMock
        .on(GetPlaceCommand)
        .resolvesOnce({
          Place: {
            Label: "Invalid Place",
            // Missing Geometry
          },
        })
        .resolvesOnce({
          Place: {
            Label: "Valid Place",
            Geometry: { Point: [-74.006, 40.7128] },
          },
        });

      const result = await service.searchPlaces({
        query: "test",
        maxResults: 10,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        label: "Valid Place",
        latitude: 40.7128,
        longitude: -74.006,
        country: undefined,
        region: undefined,
        municipality: undefined,
        postalCode: undefined,
      });
    });

    it("should use default maxResults when not provided", async () => {
      locationMock
        .on(SearchPlaceIndexForSuggestionsCommand)
        .resolves({ Results: [] });

      const result = await service.searchPlaces({
        query: "test",
      });

      expect(result).toEqual([]);
      expect(
        locationMock.commandCalls(SearchPlaceIndexForSuggestionsCommand),
      ).toHaveLength(1);
    });

    it("should handle errors gracefully", async () => {
      locationMock
        .on(SearchPlaceIndexForSuggestionsCommand)
        .rejects(new Error("AWS Service Error"));

      await expect(
        service.searchPlaces({
          query: "test",
          maxResults: 5,
        }),
      ).rejects.toThrow("Place search failed: AWS Service Error");
    });

    it("should handle unknown errors", async () => {
      locationMock
        .on(SearchPlaceIndexForSuggestionsCommand)
        .rejects("Unknown error");

      await expect(
        service.searchPlaces({
          query: "test",
          maxResults: 5,
        }),
      ).rejects.toThrow("Place search failed: Unknown error");
    });
  });

  describe("geocodeLocation", () => {
    it("should reverse geocode coordinates", async () => {
      locationMock.on(SearchPlaceIndexForPositionCommand).resolves({
        Results: [
          {
            Place: {
              Label: "123 Main St, New York, NY 10001, USA",
              Geometry: { Point: [-74.006, 40.7128] },
              Country: "USA",
              Region: "NY",
              Municipality: "New York",
              PostalCode: "10001",
            },
          },
        ],
      });

      const result = await service.geocodeLocation({
        latitude: 40.7128,
        longitude: -74.006,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        label: "123 Main St, New York, NY 10001, USA",
        latitude: 40.7128,
        longitude: -74.006,
        country: "USA",
        region: "NY",
        municipality: "New York",
        postalCode: "10001",
      });
      expect(
        locationMock.commandCalls(SearchPlaceIndexForPositionCommand),
      ).toHaveLength(1);
    });

    it("should handle empty geocoding results", async () => {
      locationMock
        .on(SearchPlaceIndexForPositionCommand)
        .resolves({ Results: [] });

      const result = await service.geocodeLocation({
        latitude: 0,
        longitude: 0,
      });

      expect(result).toEqual([]);
    });

    it("should handle geocoding errors", async () => {
      locationMock
        .on(SearchPlaceIndexForPositionCommand)
        .rejects(new Error("Invalid coordinates"));

      await expect(
        service.geocodeLocation({
          latitude: 40.7128,
          longitude: -74.006,
        }),
      ).rejects.toThrow("Geocoding failed: Invalid coordinates");
    });

    it("should handle unknown geocoding errors", async () => {
      locationMock
        .on(SearchPlaceIndexForPositionCommand)
        .rejects("Unknown geocoding error");

      await expect(
        service.geocodeLocation({
          latitude: 40.7128,
          longitude: -74.006,
        }),
      ).rejects.toThrow("Geocoding failed: Unknown geocoding error");
    });

    it("should handle extreme coordinates", async () => {
      locationMock.on(SearchPlaceIndexForPositionCommand).resolves({
        Results: [
          {
            Place: {
              Label: "North Pole",
              Geometry: { Point: [0, 90] },
            },
          },
        ],
      });

      const result = await service.geocodeLocation({
        latitude: 90,
        longitude: 0,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        label: "North Pole",
        latitude: 90,
        longitude: 0,
        country: undefined,
        region: undefined,
        municipality: undefined,
        postalCode: undefined,
      });
    });
  });

  describe("transformPlacesToResults", () => {
    it("should handle places with minimal data", async () => {
      locationMock.on(SearchPlaceIndexForSuggestionsCommand).resolves({
        Results: [{ PlaceId: "place-1", Text: "Minimal Place" }],
      });

      locationMock.on(GetPlaceCommand).resolves({
        Place: {
          Geometry: { Point: [0, 0] },
          // Missing all optional fields
        },
      });

      const result = await service.searchPlaces({
        query: "minimal",
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        label: "",
        latitude: 0,
        longitude: 0,
        country: undefined,
        region: undefined,
        municipality: undefined,
        postalCode: undefined,
      });
    });

    it("should handle places with missing geometry gracefully", async () => {
      locationMock.on(SearchPlaceIndexForSuggestionsCommand).resolves({
        Results: [
          { PlaceId: "place-1", Text: "Place without geometry" },
          { PlaceId: "place-2", Text: "Valid Place" },
        ],
      });

      locationMock
        .on(GetPlaceCommand)
        .resolvesOnce({
          Place: {
            Label: "Place without geometry",
            // Missing Geometry.Point
          },
        })
        .resolvesOnce({
          Place: {
            Label: "Valid Place",
            Geometry: { Point: [-74.006, 40.7128] },
          },
        });

      const result = await service.searchPlaces({
        query: "test",
      });

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("Valid Place");
    });

    it("should handle suggestions without PlaceId", async () => {
      locationMock.on(SearchPlaceIndexForSuggestionsCommand).resolves({
        Results: [
          { Text: "Invalid suggestion" }, // Missing PlaceId
          { PlaceId: "place-1", Text: "Valid suggestion" },
        ],
      });

      locationMock.on(GetPlaceCommand).resolves({
        Place: {
          Label: "Valid Place",
          Geometry: { Point: [-74.006, 40.7128] },
        },
      });

      const result = await service.searchPlaces({
        query: "test",
      });

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("Valid Place");
      expect(locationMock.commandCalls(GetPlaceCommand)).toHaveLength(1);
    });

    it("should handle GetPlace failures gracefully", async () => {
      locationMock.on(SearchPlaceIndexForSuggestionsCommand).resolves({
        Results: [
          { PlaceId: "place-1", Text: "Place that will fail" },
          { PlaceId: "place-2", Text: "Valid place" },
        ],
      });

      locationMock
        .on(GetPlaceCommand)
        .rejectsOnce(new Error("GetPlace failed"))
        .resolvesOnce({
          Place: {
            Label: "Valid Place",
            Geometry: { Point: [-74.006, 40.7128] },
          },
        });

      const result = await service.searchPlaces({
        query: "test",
      });

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("Valid Place");
      expect(locationMock.commandCalls(GetPlaceCommand)).toHaveLength(2);
    });

    it("should handle errors gracefully", async () => {
      locationMock
        .on(SearchPlaceIndexForSuggestionsCommand)
        .rejects(new Error("AWS Service Error"));

      await expect(
        service.searchPlaces({
          query: "test",
          maxResults: 5,
        }),
      ).rejects.toThrow("Place search failed: AWS Service Error");
    });

    it("should handle unknown errors", async () => {
      locationMock
        .on(SearchPlaceIndexForSuggestionsCommand)
        .rejects("Unknown error");

      await expect(
        service.searchPlaces({
          query: "test",
          maxResults: 5,
        }),
      ).rejects.toThrow("Place search failed: Unknown error");
    });
  });
});
