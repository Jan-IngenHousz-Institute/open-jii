import { describe, expect, it } from "vitest";

import { personName } from "./person-name";

const t = (key: string) => key;

describe("personName", () => {
  it("joins and trims the first and last name", () => {
    expect(personName({ firstName: " Lin ", lastName: "Zhao " }, t)).toBe("Lin Zhao");
    expect(personName({ firstName: "Lin", lastName: "" }, t)).toBe("Lin");
  });

  it("falls back to a server-built name", () => {
    expect(personName({ displayName: "Lab Admin" }, t)).toBe("Lab Admin");
  });

  it("never names a person by their email, whatever the placement", () => {
    const nameless = { firstName: "", lastName: "", email: "a@uni.edu" };

    expect(personName(nameless, t, { placement: "row" })).toBe("common.unnamedAccount");
    expect(personName(nameless, t, { placement: "text" })).toBe("notifications:someone");
    expect(personName(nameless, t, { placement: "byline" })).toBeNull();
  });

  it("returns a pseudonym exactly as sent", () => {
    expect(personName({ displayName: "Contributor-7F3A2C" }, t)).toBe("Contributor-7F3A2C");
  });

  it("never returns the id, whatever the placement", () => {
    const nameless = { id: "3f0c9a1e-0000-4000-8000-000000000000", firstName: " ", email: null };

    expect(personName(nameless, t)).toBe("common.unnamedAccount");
    expect(personName(nameless, t, { placement: "row" })).toBe("common.unnamedAccount");
    expect(personName(nameless, t, { placement: "text" })).toBe("notifications:someone");
    expect(personName(nameless, t, { placement: "byline" })).toBeNull();
  });
});
