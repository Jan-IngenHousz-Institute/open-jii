import { describe, expect, it } from "vitest";

import { assertLocalDatabase, readLatestSignInOtp } from "./otp.js";

describe("assertLocalDatabase", () => {
  it("accepts loopback hosts", () => {
    expect(() =>
      assertLocalDatabase("postgresql://postgres:postgres@127.0.0.1:5432/openjii_local", {}),
    ).not.toThrow();
    expect(() => assertLocalDatabase("postgresql://u:p@localhost/db", {})).not.toThrow();
    expect(() => assertLocalDatabase("postgresql://u:p@[::1]:5432/db", {})).not.toThrow();
  });

  it("refuses a remote host and names it", () => {
    expect(() => assertLocalDatabase("postgresql://u:p@db.example.internal:5432/app", {})).toThrow(
      "Refusing to read sign-in codes from db.example.internal",
    );
  });

  it("honours the same override the e2e fixtures use", () => {
    expect(() =>
      assertLocalDatabase("postgresql://u:p@db.example.internal/app", {
        E2E_ALLOW_UNSAFE_DATABASE: "1",
      }),
    ).not.toThrow();
  });
});

describe("readLatestSignInOtp", () => {
  it("rejects a remote database before opening a connection", async () => {
    await expect(
      readLatestSignInOtp("postgresql://u:p@db.example.internal:5432/app", "a@b.test"),
    ).rejects.toThrow("only a local database is allowed");
  });
});
