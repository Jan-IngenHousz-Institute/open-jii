import { expect, it } from "vitest";

import { demoLandingOrganization } from "./demo-landing";

it("finds demo memberships after ordinary rows and breaks name ties by id", () => {
  const ordinary = Array.from({ length: 120 }, (_, i) => ({
    id: `ordinary-${i}`,
    name: "A",
    type: "research",
  }));
  const later = { id: "b", name: "openJII Demo", type: "demo" };
  const earlier = { id: "a", name: "openJII Demo", type: "demo" };
  expect(demoLandingOrganization([...ordinary, later, earlier])).toEqual(earlier);
  expect(demoLandingOrganization([later, { ...earlier, name: "Z Demo" }])).toEqual(later);
  expect(demoLandingOrganization(ordinary)).toBeUndefined();
});
