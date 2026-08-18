import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

// drizzle/migrations.ts is the barrel Metro actually loads; drizzle/migrations.js
// is the one drizzle-kit regenerates. Both must list the same migrations or the
// app and the tooling silently disagree on the schema history.
function listedMigrations(barrel: string): string[] {
  const source = readFileSync(resolve(__dirname, "../../../drizzle", barrel), "utf-8");
  return [...source.matchAll(/from "\.\/(\d{4}_[a-z0-9_]+\.sql)"/g)].map((m) => m[1]);
}

describe("drizzle migration barrels", () => {
  it("migrations.ts and migrations.js list the same migrations in the same order", () => {
    const ts = listedMigrations("migrations.ts");
    const js = listedMigrations("migrations.js");

    expect(ts.length).toBeGreaterThan(0);
    expect(js).toEqual(ts);
  });
});
