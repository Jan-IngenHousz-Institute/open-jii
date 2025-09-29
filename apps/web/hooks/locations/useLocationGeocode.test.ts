import { tsr } from "@/lib/tsr";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useLocationGeocode } from "./useLocationGeocode";

// Mock the tsr module
vi.mock("@/lib/tsr", () => ({
  tsr: {
    experiments: {
      geocodeLocation: {
        useQuery: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useLocationGeocode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call useQuery with correct parameters", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: {} },
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.geocodeLocation.useQuery = mockUseQuery;

    const latitude = 52.52;
    const longitude = 13.405;

    renderHook(() => useLocationGeocode(latitude, longitude));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          latitude,
          longitude,
        },
      },
      queryKey: ["location-geocode", latitude, longitude],
      enabled: true,
    });
  });

  it("should disable query when enabled is false", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.geocodeLocation.useQuery = mockUseQuery;

    const latitude = 52.52;
    const longitude = 13.405;
    const enabled = false;

    renderHook(() => useLocationGeocode(latitude, longitude, enabled));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          latitude,
          longitude,
        },
      },
      queryKey: ["location-geocode", latitude, longitude],
      enabled: false,
    });
  });

  it("should disable query when latitude is NaN", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.geocodeLocation.useQuery = mockUseQuery;

    const latitude = NaN;
    const longitude = 13.405;

    renderHook(() => useLocationGeocode(latitude, longitude));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          latitude,
          longitude,
        },
      },
      queryKey: ["location-geocode", latitude, longitude],
      enabled: false,
    });
  });

  it("should disable query when longitude is NaN", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.geocodeLocation.useQuery = mockUseQuery;

    const latitude = 52.52;
    const longitude = NaN;

    renderHook(() => useLocationGeocode(latitude, longitude));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          latitude,
          longitude,
        },
      },
      queryKey: ["location-geocode", latitude, longitude],
      enabled: false,
    });
  });

  it("should disable query when both latitude and longitude are NaN", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.geocodeLocation.useQuery = mockUseQuery;

    const latitude = NaN;
    const longitude = NaN;

    renderHook(() => useLocationGeocode(latitude, longitude));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          latitude,
          longitude,
        },
      },
      queryKey: ["location-geocode", latitude, longitude],
      enabled: false,
    });
  });

  it("should combine enabled parameter with NaN check", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.geocodeLocation.useQuery = mockUseQuery;

    const latitude = 52.52;
    const longitude = 13.405;
    const enabled = false;

    renderHook(() => useLocationGeocode(latitude, longitude, enabled));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          latitude,
          longitude,
        },
      },
      queryKey: ["location-geocode", latitude, longitude],
      enabled: false,
    });
  });

  it("should enable query when coordinates are valid and enabled is true", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: {} },
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.geocodeLocation.useQuery = mockUseQuery;

    const latitude = 52.52;
    const longitude = 13.405;
    const enabled = true;

    renderHook(() => useLocationGeocode(latitude, longitude, enabled));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          latitude,
          longitude,
        },
      },
      queryKey: ["location-geocode", latitude, longitude],
      enabled: true,
    });
  });

  it("should return the result from useQuery", () => {
    const mockReturnValue = {
      data: {
        body: {
          place: {
            id: "place-1",
            name: "Berlin Office",
            address: "Unter den Linden 1, 10117 Berlin, Germany",
            latitude: 52.52,
            longitude: 13.405,
          },
        },
      },
      isLoading: false,
      error: null,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockReturnValue);
    mockTsr.experiments.geocodeLocation.useQuery = mockUseQuery;

    const { result } = renderHook(() => useLocationGeocode(52.52, 13.405));

    expect(result.current).toEqual(mockReturnValue);
  });

  it("should handle zero coordinates", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: {} },
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.geocodeLocation.useQuery = mockUseQuery;

    const latitude = 0;
    const longitude = 0;

    renderHook(() => useLocationGeocode(latitude, longitude));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          latitude,
          longitude,
        },
      },
      queryKey: ["location-geocode", latitude, longitude],
      enabled: true,
    });
  });

  it("should handle negative coordinates", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: {} },
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.geocodeLocation.useQuery = mockUseQuery;

    const latitude = -40.7128;
    const longitude = -74.006;

    renderHook(() => useLocationGeocode(latitude, longitude));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          latitude,
          longitude,
        },
      },
      queryKey: ["location-geocode", latitude, longitude],
      enabled: true,
    });
  });

  it("should default enabled to true when not provided", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: {} },
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.geocodeLocation.useQuery = mockUseQuery;

    const latitude = 52.52;
    const longitude = 13.405;

    renderHook(() => useLocationGeocode(latitude, longitude));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          latitude,
          longitude,
        },
      },
      queryKey: ["location-geocode", latitude, longitude],
      enabled: true,
    });
  });
});
