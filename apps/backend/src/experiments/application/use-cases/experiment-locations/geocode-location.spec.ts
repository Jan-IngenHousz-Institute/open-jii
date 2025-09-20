import { assertFailure, assertSuccess, success, failure } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort } from "../../../core/ports/aws.port";
import { GeocodeLocationUseCase } from "./geocode-location";

describe("GeocodeLocationUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GeocodeLocationUseCase;
  let awsPort: AwsPort;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(GeocodeLocationUseCase);
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

  it("should return geocoding results when AWS Location Service returns places", async () => {
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

    // Mock the AWS Location Port to return successful results
    vi.spyOn(awsPort, "geocodeLocation").mockResolvedValue(success(mockGeocodeResults));

    const result = await useCase.execute({
      latitude: 40.7128,
      longitude: -74.006,
    });

    assertSuccess(result);
    expect(result.value).toHaveLength(1);
    expect(result.value).toEqual(mockGeocodeResults);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(awsPort.geocodeLocation).toHaveBeenCalledWith({
      latitude: 40.7128,
      longitude: -74.006,
    });
  });

  it("should return empty array when AWS Location Service returns no results", async () => {
    // Mock the AWS Location Port to return empty results
    vi.spyOn(awsPort, "geocodeLocation").mockResolvedValue(success([]));

    const result = await useCase.execute({
      latitude: 0,
      longitude: 0,
    });

    assertSuccess(result);
    expect(result.value).toEqual([]);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(awsPort.geocodeLocation).toHaveBeenCalledWith({
      latitude: 0,
      longitude: 0,
    });
  });

  it("should return failure when AWS Location Service fails", async () => {
    const mockError = {
      message: "AWS Location Service unavailable",
      code: "AWS_ERROR",
    };

    // Mock the AWS Location Port to return failure
    vi.spyOn(awsPort, "geocodeLocation").mockResolvedValue(failure(mockError));

    const result = await useCase.execute({
      latitude: 40.7128,
      longitude: -74.006,
    });

    assertFailure(result);
    expect(result.error).toEqual(mockError);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(awsPort.geocodeLocation).toHaveBeenCalledWith({
      latitude: 40.7128,
      longitude: -74.006,
    });
  });

  it("should handle edge cases with extreme coordinates", async () => {
    const mockGeocodeResults = [
      {
        label: "North Pole",
        latitude: 90,
        longitude: 0,
        country: undefined,
        region: undefined,
        municipality: undefined,
        postalCode: undefined,
      },
    ];

    // Mock the AWS Location Port to return results for extreme coordinates
    vi.spyOn(awsPort, "geocodeLocation").mockResolvedValue(success(mockGeocodeResults));

    const result = await useCase.execute({
      latitude: 90,
      longitude: 0,
    });

    assertSuccess(result);
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toEqual({
      label: "North Pole",
      latitude: 90,
      longitude: 0,
      country: undefined,
      region: undefined,
      municipality: undefined,
      postalCode: undefined,
    });
  });

  it("should handle results with minimal data", async () => {
    const mockGeocodeResults = [
      {
        label: "Unknown Location",
        latitude: 12.345,
        longitude: 67.89,
      },
    ];

    // Mock the AWS Location Port to return results with minimal data
    vi.spyOn(awsPort, "geocodeLocation").mockResolvedValue(success(mockGeocodeResults));

    const result = await useCase.execute({
      latitude: 12.345,
      longitude: 67.89,
    });

    assertSuccess(result);
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toEqual({
      label: "Unknown Location",
      latitude: 12.345,
      longitude: 67.89,
    });
  });

  it("should handle high precision coordinates", async () => {
    const mockGeocodeResults = [
      {
        label: "Precise Location",
        latitude: 40.7127753,
        longitude: -74.0059728,
        country: "USA",
        region: "NY",
        municipality: "New York",
        postalCode: "10001",
      },
    ];

    // Mock the AWS Location Port to return results for high precision coordinates
    vi.spyOn(awsPort, "geocodeLocation").mockResolvedValue(success(mockGeocodeResults));

    const result = await useCase.execute({
      latitude: 40.7127753,
      longitude: -74.0059728,
    });

    assertSuccess(result);
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toEqual({
      label: "Precise Location",
      latitude: 40.7127753,
      longitude: -74.0059728,
      country: "USA",
      region: "NY",
      municipality: "New York",
      postalCode: "10001",
    });
  });
});
