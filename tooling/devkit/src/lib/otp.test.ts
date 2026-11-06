import { symmetricEncrypt } from "better-auth/crypto";
import { describe, expect, it, vi } from "vitest";

import { assertLocalDatabase, readLatestSignInOtp } from "./otp.js";

const LOCAL_DATABASE = "postgresql://postgres:postgres@127.0.0.1:5432/openjii_local";

const stored = vi.hoisted(() => ({ value: "" }));

// The one query the reader makes returns the stored verification value.
vi.mock("postgres", () => ({
  default: () =>
    Object.assign(() => Promise.resolve([{ value: stored.value }]), {
      end: () => Promise.resolve(),
    }),
}));

async function storeEncrypted(otp: string, secret: string) {
  stored.value = `${await symmetricEncrypt({ key: secret, data: otp })}:0`;
}

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

  it("counts a host smuggled in through the query string", () => {
    expect(() =>
      assertLocalDatabase("postgresql://u:p@127.0.0.1:5432/app?host=db.example.internal", {}),
    ).toThrow("db.example.internal");
    expect(() =>
      assertLocalDatabase("postgresql://u:p@localhost/app?hostaddr=10.0.0.5", {}),
    ).toThrow("10.0.0.5");
    expect(() => assertLocalDatabase("postgresql:///app?host=/var/run/postgresql", {})).toThrow();
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
      readLatestSignInOtp("postgresql://u:p@db.example.internal:5432/app", "a@b.test", "secret"),
    ).rejects.toThrow("only a local database is allowed");
  });

  it("decrypts the stored code with the backend's AUTH_SECRET", async () => {
    await storeEncrypted("123456", "local-secret");

    await expect(readLatestSignInOtp(LOCAL_DATABASE, "a@b.test", "local-secret")).resolves.toBe(
      "123456",
    );
  });

  it("names AUTH_SECRET when the code was encrypted with another secret", async () => {
    await storeEncrypted("123456", "local-secret");

    await expect(readLatestSignInOtp(LOCAL_DATABASE, "a@b.test", "another-secret")).rejects.toThrow(
      "is AUTH_SECRET the backend's?",
    );
  });
});
