import { describe, expect, it } from "vitest";

import { zExperimentDataContributor } from "./experiment-data.schema";

describe("measured contributor contract", () => {
  it("preserves raw names and guest flags without inserting display labels", () => {
    expect(
      zExperimentDataContributor.parse({
        id: "guest",
        name: "Synthetic",
        avatar: null,
        isGuest: true,
        isFormerGuest: false,
      }),
    ).toEqual({
      id: "guest",
      name: "Synthetic",
      avatar: null,
      isGuest: true,
      isFormerGuest: false,
    });
  });
  it("keeps existing contributor structs compatible", () => {
    expect(
      zExperimentDataContributor.parse({ id: "researcher", name: "Researcher", avatar: null }),
    ).toMatchObject({ name: "Researcher", isGuest: false, isFormerGuest: false });
  });
});
