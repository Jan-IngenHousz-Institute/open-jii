import { describe, expect, it } from "vitest";

import {
  zAddExperimentLocationsBody,
  zExperimentGeocodeQuery,
  zExperimentLocation,
  zExperimentLocationInput,
  zExperimentPlaceSearchQuery,
  zExperimentPlaceSearchResult,
} from "./experiment-locations.schema";

const input = {
  name: "Field A",
  latitude: 51.5,
  longitude: -0.12,
};

describe("zExperimentLocationInput", () => {
  it("accepts a valid input with optional address fields", () => {
    const withAddress = { ...input, country: "GB", region: "London", postalCode: "SW1" };
    expect(zExperimentLocationInput.parse(withAddress)).toEqual(withAddress);
  });

  it("requires a non-empty name", () => {
    expect(zExperimentLocationInput.safeParse({ ...input, name: "" }).success).toBe(false);
  });

  it("rejects out-of-range latitude and longitude", () => {
    expect(zExperimentLocationInput.safeParse({ ...input, latitude: 91 }).success).toBe(false);
    expect(zExperimentLocationInput.safeParse({ ...input, longitude: -181 }).success).toBe(false);
  });
});

describe("zExperimentLocation", () => {
  it("accepts a persisted location", () => {
    const loc = {
      ...input,
      id: "11111111-1111-1111-1111-111111111111",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };
    expect(zExperimentLocation.parse(loc)).toEqual(loc);
  });

  it("rejects a non-uuid id", () => {
    expect(
      zExperimentLocation.safeParse({
        ...input,
        id: "x",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});

describe("zExperimentPlaceSearchResult / Query", () => {
  it("accepts a place result", () => {
    const result = { label: "London", latitude: 51.5, longitude: -0.12 };
    expect(zExperimentPlaceSearchResult.parse(result)).toEqual(result);
  });

  it("requires a non-empty query and defaults maxResults to 10", () => {
    expect(zExperimentPlaceSearchQuery.parse({ query: "london" }).maxResults).toBe(10);
    expect(zExperimentPlaceSearchQuery.safeParse({ query: "" }).success).toBe(false);
  });

  it("coerces and caps maxResults", () => {
    expect(zExperimentPlaceSearchQuery.parse({ query: "l", maxResults: "5" }).maxResults).toBe(5);
    expect(zExperimentPlaceSearchQuery.safeParse({ query: "l", maxResults: 51 }).success).toBe(
      false,
    );
  });
});

describe("zExperimentGeocodeQuery", () => {
  it("coerces string lat/lon", () => {
    const parsed = zExperimentGeocodeQuery.parse({ latitude: "51.5", longitude: "-0.12" });
    expect(parsed).toEqual({ latitude: 51.5, longitude: -0.12 });
  });

  it("rejects out-of-range coordinates", () => {
    expect(zExperimentGeocodeQuery.safeParse({ latitude: "100", longitude: "0" }).success).toBe(
      false,
    );
  });
});

describe("zAddExperimentLocationsBody", () => {
  it("accepts a list of location inputs", () => {
    expect(zAddExperimentLocationsBody.parse({ locations: [input] })).toEqual({
      locations: [input],
    });
  });

  it("rejects an invalid location in the list", () => {
    expect(
      zAddExperimentLocationsBody.safeParse({ locations: [{ ...input, latitude: 999 }] }).success,
    ).toBe(false);
  });
});
