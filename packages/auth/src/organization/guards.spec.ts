import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";

import { assertVisibilityChangeAllowed, resolveCreateVisibility } from "./guards";

describe("visibility on create", () => {
  it("honours the visibility the creator asked for", () => {
    expect(resolveCreateVisibility("public")).toBe("public");
    expect(resolveCreateVisibility("private")).toBe("private");
  });

  it("defaults to private when the body names none", () => {
    expect(resolveCreateVisibility(undefined)).toBe("private");
    expect(resolveCreateVisibility(null)).toBe("private");
  });

  it.each([["Public"], ["unlisted"], [""], [true], [{ visibility: "public" }]])(
    "refuses %s",
    (value) => {
      expect(() => resolveCreateVisibility(value)).toThrow(APIError);
      expect(() => resolveCreateVisibility(value)).toThrow(/private.*public/u);
    },
  );
});

describe("visibility on change", () => {
  it("lets an owner set either state", () => {
    expect(() => assertVisibilityChangeAllowed("public", "owner")).not.toThrow();
    expect(() => assertVisibilityChangeAllowed("private", "owner")).not.toThrow();
  });

  it.each([["admin"], ["member"], [""]])("refuses %s", (role) => {
    expect(() => assertVisibilityChangeAllowed("public", role)).toThrow(/owner/u);
  });

  // The role check runs first, so this is the arm the create path shares.
  it("refuses a value outside the two states even from an owner", () => {
    expect(() => assertVisibilityChangeAllowed("unlisted", "owner")).toThrow(/private.*public/u);
  });
});
