import { assertMonotonicVisibility } from "./visibility-transition";

describe("assertMonotonicVisibility", () => {
  it("allows private → public", () => {
    expect(assertMonotonicVisibility("private", "public")).toBeNull();
  });

  it("rejects public → private", () => {
    const err = assertMonotonicVisibility("public", "private");
    expect(err).not.toBeNull();
    expect(err?.code).toBe("VISIBILITY_TRANSITION_FORBIDDEN");
    expect(err?.statusCode).toBe(400);
  });

  it("allows no-op transitions", () => {
    expect(assertMonotonicVisibility("public", "public")).toBeNull();
    expect(assertMonotonicVisibility("private", "private")).toBeNull();
  });

  it("allows an undefined/absent next visibility (field not being updated)", () => {
    expect(assertMonotonicVisibility("public", undefined)).toBeNull();
    expect(assertMonotonicVisibility("private", undefined)).toBeNull();
    expect(assertMonotonicVisibility(null, null)).toBeNull();
  });
});
