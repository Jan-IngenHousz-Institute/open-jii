import { fromPartial } from "@total-typescript/shoehorn";
import type * as AuthPlugins from "better-auth/plugins";
import { organization } from "better-auth/plugins";
import { describe, expect, it, vi } from "vitest";

import { openJiiOrganization } from "./plugin";

vi.mock("better-auth/plugins", async (original) => {
  const actual = await original<typeof AuthPlugins>();
  return { ...actual, organization: vi.fn(actual.organization) };
});

describe("organization creation identity policy", () => {
  it("refuses guests while allowing researchers, including older records without an anonymous flag", async () => {
    openJiiOrganization();
    const allow = vi
      .mocked(organization)
      .mock.calls.slice(-1)[0]?.[0]?.allowUserToCreateOrganization;
    if (typeof allow !== "function") throw new Error("missing organization creation policy");
    for (const [isAnonymous, expected] of [
      [true, false],
      [false, true],
      [undefined, true],
    ] as const) {
      expect(await allow(fromPartial<Parameters<typeof allow>[0]>({ isAnonymous }))).toBe(expected);
    }
  });
});
