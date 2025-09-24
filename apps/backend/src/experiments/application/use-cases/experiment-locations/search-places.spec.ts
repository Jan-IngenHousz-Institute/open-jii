import { assertFailure, assertSuccess, success, failure } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort } from "../../../core/ports/aws.port";
import { SearchPlacesUseCase } from "./search-places";

describe("SearchPlacesUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: SearchPlacesUseCase;
  let awsPort: AwsPort;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(SearchPlacesUseCase);
    awsPort = testApp.module.get(AWS_PORT);

    // Reset any mocks before each test
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return search results when AWS Location Service returns places", async () => {
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

    // Mock the AWS Location Port to return successful results
    vi.spyOn(awsPort, "searchPlaces").mockResolvedValue(success(mockSearchResults));

    const result = await useCase.execute({
      query: "New York",
      maxResults: 10,
    });

    assertSuccess(result);
    expect(result.value).toHaveLength(2);
    expect(result.value).toEqual(mockSearchResults);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(awsPort.searchPlaces).toHaveBeenCalledWith({
      query: "New York",
      maxResults: 10,
    });
  });

  it("should return empty array when AWS Location Service returns no results", async () => {
    // Mock the AWS Location Port to return empty results
    vi.spyOn(awsPort, "searchPlaces").mockResolvedValue(success([]));

    const result = await useCase.execute({
      query: "NonexistentPlace12345",
      maxResults: 10,
    });

    assertSuccess(result);
    expect(result.value).toEqual([]);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(awsPort.searchPlaces).toHaveBeenCalledWith({
      query: "NonexistentPlace12345",
      maxResults: 10,
    });
  });

  it("should return failure when AWS Location Service fails", async () => {
    const mockError = {
      message: "AWS Location Service unavailable",
      code: "AWS_ERROR",
    };

    // Mock the AWS Location Port to return failure
    vi.spyOn(awsPort, "searchPlaces").mockResolvedValue(failure(mockError));

    const result = await useCase.execute({
      query: "New York",
      maxResults: 10,
    });

    assertFailure(result);
    expect(result.error).toEqual(mockError);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(awsPort.searchPlaces).toHaveBeenCalledWith({
      query: "New York",
      maxResults: 10,
    });
  });

  it("should use default maxResults when not provided", async () => {
    const mockSearchResults = [
      {
        label: "Paris, France",
        latitude: 48.8566,
        longitude: 2.3522,
        country: "France",
        region: "Île-de-France",
        municipality: "Paris",
        postalCode: "75001",
      },
    ];

    // Mock the AWS Location Port to return successful results
    vi.spyOn(awsPort, "searchPlaces").mockResolvedValue(success(mockSearchResults));

    const result = await useCase.execute({
      query: "Paris",
    });

    assertSuccess(result);
    expect(result.value).toEqual(mockSearchResults);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(awsPort.searchPlaces).toHaveBeenCalledWith({
      query: "Paris",
      maxResults: undefined,
    });
  });

  it("should handle edge case with empty query", async () => {
    // Mock the AWS Location Port to return empty results for empty query
    vi.spyOn(awsPort, "searchPlaces").mockResolvedValue(success([]));

    const result = await useCase.execute({
      query: "",
      maxResults: 5,
    });

    assertSuccess(result);
    expect(result.value).toEqual([]);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(awsPort.searchPlaces).toHaveBeenCalledWith({
      query: "",
      maxResults: 5,
    });
  });

  it("should handle places with minimal data", async () => {
    const mockSearchResults = [
      {
        label: "Unknown Location",
        latitude: 0,
        longitude: 0,
      },
    ];

    // Mock the AWS Location Port to return results with minimal data
    vi.spyOn(awsPort, "searchPlaces").mockResolvedValue(success(mockSearchResults));

    const result = await useCase.execute({
      query: "unknown",
      maxResults: 1,
    });

    assertSuccess(result);
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toEqual({
      label: "Unknown Location",
      latitude: 0,
      longitude: 0,
    });
  });
});
