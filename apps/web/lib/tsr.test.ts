import { describe, it, expect } from "vitest";

import { getContractError } from "./tsr";

describe("getContractError", () => {
  const route = {} as never;

  it("returns undefined for Error instances", () => {
    expect(getContractError(route, new Error("network"))).toBeUndefined();
  });

  it("returns undefined for null and non-objects", () => {
    expect(getContractError(route, null)).toBeUndefined();
    expect(getContractError(route, undefined)).toBeUndefined();
    expect(getContractError(route, "err")).toBeUndefined();
    expect(getContractError(route, 1)).toBeUndefined();
  });

  it("returns undefined when status is missing or not a number", () => {
    expect(getContractError(route, { body: {} })).toBeUndefined();
    expect(getContractError(route, { status: "404" })).toBeUndefined();
  });

  it("returns the error object when it has a numeric status", () => {
    const err = { status: 409, body: { message: "conflict" }, headers: new Headers() };
    expect(getContractError(route, err)).toBe(err);
  });
});
