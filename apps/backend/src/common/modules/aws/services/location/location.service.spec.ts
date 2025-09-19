import { TestHarness } from "../../../../../test/test-harness";
import { AwsLocationService } from "./location.service";

// Mock the AWS SDK with vi.hoisted to avoid hoisting issues
const mockSend = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-location", () => {
  const mockLocationClient = {
    send: mockSend,
  };

  return {
    LocationClient: vi.fn(() => mockLocationClient),
    SearchPlaceIndexForTextCommand: vi.fn(),
    SearchPlaceIndexForPositionCommand: vi.fn(),
  };
});

describe("AwsLocationService", () => {
  const testApp = TestHarness.App;
  let service: AwsLocationService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    service = testApp.module.get(AwsLocationService);
    vi.clearAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("searchPlaces", () => {
    it("should search for places and return formatted results", async () => {
      const mockResponse = {
        Results: [
          {
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
          },
          {
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
          },
        ],
      };

      mockSend.mockResolvedValue(mockResponse);

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
    });

    it("should handle empty results", async () => {
      const mockResponse = {
        Results: [],
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await service.searchPlaces({
        query: "NonexistentPlace12345",
        maxResults: 5,
      });

      expect(result).toEqual([]);
    });

    it("should handle results with missing geometry", async () => {
      const mockResponse = {
        Results: [
          {
            Place: {
              Label: "Invalid Place",
              // Missing Geometry
            },
          },
          {
            Place: {
              Label: "Valid Place",
              Geometry: {
                Point: [-74.006, 40.7128],
              },
            },
          },
        ],
      };

      mockSend.mockResolvedValue(mockResponse);

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
      const mockResponse = {
        Results: [],
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await service.searchPlaces({
        query: "test",
      });

      expect(result).toEqual([]);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("should handle errors gracefully", async () => {
      const mockError = new Error("AWS Service Error");
      mockSend.mockRejectedValue(mockError);

      await expect(
        service.searchPlaces({
          query: "test",
          maxResults: 5,
        }),
      ).rejects.toThrow("Place search failed: AWS Service Error");
    });

    it("should handle unknown errors", async () => {
      mockSend.mockRejectedValue("Unknown error");

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
      const mockResponse = {
        Results: [
          {
            Place: {
              Label: "123 Main St, New York, NY 10001, USA",
              Geometry: {
                Point: [-74.006, 40.7128],
              },
              Country: "USA",
              Region: "NY",
              Municipality: "New York",
              PostalCode: "10001",
            },
          },
        ],
      };

      mockSend.mockResolvedValue(mockResponse);

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

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("should handle empty geocoding results", async () => {
      const mockResponse = {
        Results: [],
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await service.geocodeLocation({
        latitude: 0,
        longitude: 0,
      });

      expect(result).toEqual([]);
    });

    it("should handle geocoding errors", async () => {
      const mockError = new Error("Invalid coordinates");
      mockSend.mockRejectedValue(mockError);

      await expect(
        service.geocodeLocation({
          latitude: 40.7128,
          longitude: -74.006,
        }),
      ).rejects.toThrow("Geocoding failed: Invalid coordinates");
    });

    it("should handle unknown geocoding errors", async () => {
      mockSend.mockRejectedValue("Unknown geocoding error");

      await expect(
        service.geocodeLocation({
          latitude: 40.7128,
          longitude: -74.006,
        }),
      ).rejects.toThrow("Geocoding failed: Unknown error");
    });

    it("should handle extreme coordinates", async () => {
      const mockResponse = {
        Results: [
          {
            Place: {
              Label: "North Pole",
              Geometry: {
                Point: [0, 90],
              },
            },
          },
        ],
      };

      mockSend.mockResolvedValue(mockResponse);

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
      const mockResponse = {
        Results: [
          {
            Place: {
              Geometry: {
                Point: [0, 0],
              },
              // Missing all optional fields
            },
          },
        ],
      };

      mockSend.mockResolvedValue(mockResponse);

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
      // This test covers the filter in transformPlacesToResults that filters out invalid places
      const mockResponse = {
        Results: [
          {
            Place: {
              Label: "Place without geometry",
              // Missing Geometry.Point
            },
          },
          {
            Place: {
              Label: "Valid Place",
              Geometry: {
                Point: [-74.006, 40.7128],
              },
            },
          },
        ],
      };

      mockSend.mockResolvedValue(mockResponse);

      const result = await service.searchPlaces({
        query: "test",
      });

      // Should only return the valid place, filtering out the one without geometry
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("Valid Place");
    });
  });
});
