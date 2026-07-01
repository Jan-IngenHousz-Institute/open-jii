import { describe, expect, it } from "vitest";

import { contract } from "./contract";

// Walk every procedure in the aggregate oRPC contract and assert the HTTP
// surface is well-formed. These are the invariants clients depend on: a
// procedure that loses its route, gains a bad method/status, or collides with
// another endpoint's (method, path) is a breaking API change, and this catches
// it without hand-maintaining a route table.

interface OrpcRoute {
  method?: string;
  path?: string;
  successStatus?: number;
}

interface ContractProcedure {
  "~orpc": {
    route?: OrpcRoute;
    inputSchema?: unknown;
    outputSchema?: unknown;
  };
}

const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const SUCCESS_STATUSES = new Set([200, 201, 202, 204]);

function isProcedure(value: unknown): value is ContractProcedure {
  return (
    typeof value === "object" &&
    value !== null &&
    "~orpc" in value &&
    typeof (value as ContractProcedure)["~orpc"] === "object"
  );
}

function collectProcedures(): { key: string; procedure: ContractProcedure }[] {
  const out: { key: string; procedure: ContractProcedure }[] = [];
  for (const [domain, group] of Object.entries(contract)) {
    for (const [name, value] of Object.entries(group as Record<string, unknown>)) {
      if (isProcedure(value)) {
        out.push({ key: `${domain}.${name}`, procedure: value });
      }
    }
  }
  return out;
}

const procedures = collectProcedures();

describe("orpc contract surface", () => {
  it("exposes procedures across every domain", () => {
    expect(Object.keys(contract).sort()).toEqual([
      "experiments",
      "health",
      "iot",
      "macros",
      "protocols",
      "users",
      "workbooks",
    ]);
    expect(procedures.length).toBeGreaterThan(50);
  });

  describe.each(procedures)("$key", ({ procedure }) => {
    const route = procedure["~orpc"].route ?? {};

    it("has a valid HTTP method", () => {
      expect(HTTP_METHODS.has(route.method ?? "")).toBe(true);
    });

    it("has an absolute path", () => {
      expect(typeof route.path).toBe("string");
      expect(route.path?.startsWith("/")).toBe(true);
    });

    it("has a success status", () => {
      expect(SUCCESS_STATUSES.has(route.successStatus ?? 0)).toBe(true);
    });

    it("declares an output schema", () => {
      expect(procedure["~orpc"].outputSchema).toBeDefined();
    });

    it("balances its path-param braces", () => {
      const open = (route.path?.match(/\{/g) ?? []).length;
      const close = (route.path?.match(/\}/g) ?? []).length;
      expect(open).toBe(close);
    });
  });

  it("has no duplicate (method, path) across the whole API", () => {
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const { key, procedure } of procedures) {
      const { method, path } = procedure["~orpc"].route ?? {};
      const id = `${method} ${path}`;
      const prev = seen.get(id);
      if (prev) {
        collisions.push(`${id} used by both ${prev} and ${key}`);
      } else {
        seen.set(id, key);
      }
    }
    expect(collisions).toEqual([]);
  });

  it("prefixes non-health routes under /api/v1", () => {
    const offenders = procedures
      .filter(({ procedure }) => {
        const path = procedure["~orpc"].route?.path ?? "";
        return !path.startsWith("/api/v1/") && !path.startsWith("/health");
      })
      .map(({ key }) => key);
    expect(offenders).toEqual([]);
  });
});
