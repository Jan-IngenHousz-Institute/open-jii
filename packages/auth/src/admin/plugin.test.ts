import { fromPartial } from "@total-typescript/shoehorn";
import { admin } from "better-auth/plugins";
import { describe, expect, it } from "vitest";

import { DISABLED_ADMIN_PATHS, openJiiAdmin } from "./plugin";

describe("openJII admin plugin", () => {
  it("keeps the complete installed admin endpoint inventory disabled", () => {
    expect([...DISABLED_ADMIN_PATHS].sort()).toEqual(
      Object.values(admin().endpoints)
        .map((endpoint) => endpoint.path)
        .sort(),
    );
  });

  it("keeps the plugin's schema and banned-session hooks", () => {
    const plugin = openJiiAdmin();
    expect(plugin.schema).toHaveProperty("user.fields.role");
    expect(plugin.init).toBeTypeOf("function");
    expect(plugin.hooks.after).toBeDefined();
  });

  it("closes known and future admin paths while leaving other routes alone", () => {
    const [guard] = openJiiAdmin().hooks.before;
    for (const path of [...DISABLED_ADMIN_PATHS, "/admin/future-action"])
      expect(guard.matcher({ path })).toBe(true);
    for (const path of [undefined, "/get-session", "/organization/create", "/administrator"])
      expect(guard.matcher({ path })).toBe(false);
  });

  it("refuses an admin request with a 404 before any plugin permission can apply", async () => {
    const [guard] = openJiiAdmin().hooks.before;
    await expect(
      guard.handler(fromPartial<Parameters<typeof guard.handler>[0]>({})),
    ).rejects.toMatchObject({ status: "NOT_FOUND", body: { message: "Not found" } });
  });
});
