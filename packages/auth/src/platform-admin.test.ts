import { describe, expect, it, vi } from "vitest";

import { parseAdminUserIds } from "./platform-admin";

const id = "05824da8-18f8-48fb-a3cc-c303b83164c5";

describe("ADMIN_USER_IDS", () => {
  it.each([undefined, "", "  ,  "])("has no admins for %s", (input) => {
    expect(parseAdminUserIds(input)).toEqual([]);
  });
  it("trims, normalizes and deduplicates UUIDs while ignoring invalid entries", () => {
    const warn = vi.fn();
    expect(parseAdminUserIds(` ${id.toUpperCase()},bad,${id}`, warn)).toEqual([id]);
    expect(warn).toHaveBeenCalledExactlyOnceWith("Ignored malformed ADMIN_USER_IDS entry");
  });
});
