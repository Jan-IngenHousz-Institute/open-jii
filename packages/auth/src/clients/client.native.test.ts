import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import { describe, expect, it, vi } from "vitest";

import { createOpenJiiAuthClient } from "./client.native";

vi.mock("@better-auth/expo/client", () => ({ expoClient: vi.fn(() => ({ id: "expo" })) }));
vi.mock("better-auth/react", () => ({ createAuthClient: vi.fn(() => ({ client: "native" })) }));

describe("native auth client", () => {
  it("installs guest entry with the existing native, organization and sign-in plugins", () => {
    const storage = { getItem: vi.fn(), setItem: vi.fn() };
    expect(createOpenJiiAuthClient("http://localhost:3020", storage)).toEqual({ client: "native" });
    const options = vi.mocked(createAuthClient).mock.calls[0]?.[0];
    expect(options?.baseURL).toBe("http://localhost:3020/api/v1/auth");
    expect(options?.plugins?.map((plugin) => plugin.id)).toEqual([
      "anonymous",
      "email-otp",
      "generic-oauth-client",
      "organization",
      "expo",
    ]);
    expect(expoClient).toHaveBeenCalledWith({
      scheme: "openjii",
      storagePrefix: "openjii",
      storage,
    });
  });
});
