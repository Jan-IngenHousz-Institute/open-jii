import { tsr } from "@/lib/tsr";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useLocationSearch } from "./useLocationSearch";

// Mock the tsr module
vi.mock("@/lib/tsr", () => ({
  tsr: {
    experiments: {
      searchPlaces: {
        useQuery: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useLocationSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call useQuery with correct parameters", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.searchPlaces.useQuery = mockUseQuery;

    const query = "Berlin";
    const maxResults = 10;

    renderHook(() => useLocationSearch(query, maxResults));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          query,
          maxResults,
        },
      },
      queryKey: ["location-search", query, maxResults],
      enabled: true,
    });
  });

  it("should call useQuery with correct parameters when maxResults is undefined", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.searchPlaces.useQuery = mockUseQuery;

    const query = "Berlin";

    renderHook(() => useLocationSearch(query));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          query,
          maxResults: undefined,
        },
      },
      queryKey: ["location-search", query, undefined],
      enabled: true,
    });
  });

  it("should disable query when enabled is false", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.searchPlaces.useQuery = mockUseQuery;

    const query = "Berlin";
    const enabled = false;

    renderHook(() => useLocationSearch(query, undefined, enabled));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          query,
          maxResults: undefined,
        },
      },
      queryKey: ["location-search", query, undefined],
      enabled: false,
    });
  });

  it("should disable query when query length is 2 or less", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.searchPlaces.useQuery = mockUseQuery;

    const shortQuery = "Be";

    renderHook(() => useLocationSearch(shortQuery));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          query: shortQuery,
          maxResults: undefined,
        },
      },
      queryKey: ["location-search", shortQuery, undefined],
      enabled: false,
    });
  });

  it("should enable query when query length is more than 2 characters", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.searchPlaces.useQuery = mockUseQuery;

    const validQuery = "Berlin Office";

    renderHook(() => useLocationSearch(validQuery));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          query: validQuery,
          maxResults: undefined,
        },
      },
      queryKey: ["location-search", validQuery, undefined],
      enabled: true,
    });
  });

  it("should return the result from useQuery", () => {
    const mockReturnValue = {
      data: {
        body: [
          {
            id: "place-1",
            name: "Berlin Office",
            latitude: 52.52,
            longitude: 13.405,
          },
          {
            id: "place-2",
            name: "Berlin Central Station",
            latitude: 52.525,
            longitude: 13.369,
          },
        ],
      },
      isLoading: false,
      error: null,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockReturnValue);
    mockTsr.experiments.searchPlaces.useQuery = mockUseQuery;

    const { result } = renderHook(() => useLocationSearch("Berlin"));

    expect(result.current).toEqual(mockReturnValue);
  });

  it("should handle empty query string", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.searchPlaces.useQuery = mockUseQuery;

    const emptyQuery = "";

    renderHook(() => useLocationSearch(emptyQuery));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          query: emptyQuery,
          maxResults: undefined,
        },
      },
      queryKey: ["location-search", emptyQuery, undefined],
      enabled: false,
    });
  });

  it("should combine enabled parameter with query length check", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.searchPlaces.useQuery = mockUseQuery;

    const validQuery = "Berlin Office";
    const enabled = false;

    renderHook(() => useLocationSearch(validQuery, undefined, enabled));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          query: validQuery,
          maxResults: undefined,
        },
      },
      queryKey: ["location-search", validQuery, undefined],
      enabled: false,
    });
  });

  it("should pass all parameters correctly with maxResults and enabled", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
    });
    mockTsr.experiments.searchPlaces.useQuery = mockUseQuery;

    const query = "Berlin Office";
    const maxResults = 5;
    const enabled = true;

    renderHook(() => useLocationSearch(query, maxResults, enabled));

    expect(mockUseQuery).toHaveBeenCalledWith({
      queryData: {
        query: {
          query,
          maxResults,
        },
      },
      queryKey: ["location-search", query, maxResults],
      enabled: true,
    });
  });
});
