import { describe, expect, it, beforeEach } from "vitest";

import { WellKnownColumnTypes } from "@repo/api/schemas/experiment.schema";

import { ContributorAnonymizerService } from "./contributor-anonymizer.service";

describe("ContributorAnonymizerService", () => {
  let service: ContributorAnonymizerService;

  beforeEach(() => {
    service = new ContributorAnonymizerService();
  });

  describe("pseudonymFor", () => {
    it("produces a stable label for the same (experimentId, userId) pair", () => {
      const a = service.pseudonymFor("exp-1", "user-1");
      const b = service.pseudonymFor("exp-1", "user-1");
      expect(a).toBe(b);
      expect(a).toMatch(/^Contributor-[0-9A-F]{6}$/);
    });

    it("yields different labels for different users in the same experiment", () => {
      expect(service.pseudonymFor("exp-1", "user-1")).not.toBe(
        service.pseudonymFor("exp-1", "user-2"),
      );
    });

    it("yields different labels for the same user across experiments", () => {
      expect(service.pseudonymFor("exp-1", "user-1")).not.toBe(
        service.pseudonymFor("exp-2", "user-1"),
      );
    });
  });

  describe("anonymizeRows", () => {
    const contributorColumn = {
      name: "contributor",
      type_text: WellKnownColumnTypes.CONTRIBUTOR,
    };
    const valueColumn = { name: "value", type_text: "DOUBLE" };

    it("passes rows through untouched when the flag is off", () => {
      const rows = [
        {
          contributor: JSON.stringify({ id: "u1", name: "Alice", avatar: "https://a" }),
          value: "42",
        },
      ];
      const out = service.anonymizeRows(rows, [contributorColumn, valueColumn], {
        id: "exp-1",
        anonymizeContributors: false,
      });
      expect(out).toBe(rows);
    });

    it("passes rows through untouched when the table has no CONTRIBUTOR columns", () => {
      const rows = [{ value: "42" }];
      const out = service.anonymizeRows(rows, [valueColumn], {
        id: "exp-1",
        anonymizeContributors: true,
      });
      expect(out).toBe(rows);
    });

    it("rewrites CONTRIBUTOR cells when the flag is on", () => {
      const rows = [
        {
          contributor: JSON.stringify({ id: "u1", name: "Alice", avatar: "https://a" }),
          value: "42",
        },
      ];
      const [out] = service.anonymizeRows(rows, [contributorColumn, valueColumn], {
        id: "exp-1",
        anonymizeContributors: true,
      });
      if (typeof out.contributor !== "string") throw new Error("expected serialized contributor");
      const parsed = JSON.parse(out.contributor) as {
        id: string;
        name: string;
        avatar: string | null;
      };
      expect(parsed.name).toMatch(/^Contributor-[0-9A-F]{6}$/);
      expect(parsed.id).toBe(parsed.name);
      expect(parsed.avatar).toBeNull();
      expect(out.value).toBe("42");
    });

    it("leaves null contributor cells alone", () => {
      const rows = [{ contributor: null, value: "42" }];
      const [out] = service.anonymizeRows(rows, [contributorColumn, valueColumn], {
        id: "exp-1",
        anonymizeContributors: true,
      });
      expect(out.contributor).toBeNull();
    });

    it("does not touch other STRUCT-typed columns", () => {
      const otherStruct = { name: "thing", type_text: "STRUCT<a: INT, b: INT>" };
      const rows = [
        {
          thing: JSON.stringify({ a: 1, b: 2 }),
          contributor: JSON.stringify({ id: "u1", name: "Alice", avatar: "" }),
        },
      ];
      const [out] = service.anonymizeRows(rows, [otherStruct, contributorColumn], {
        id: "exp-1",
        anonymizeContributors: true,
      });
      expect(out.thing).toBe(rows[0].thing);
      if (typeof out.contributor !== "string") throw new Error("expected serialized contributor");
      const parsed = JSON.parse(out.contributor) as { name: string };
      expect(parsed.name).not.toBe("Alice");
    });

    it("returns a fresh array — does not mutate the caller's row objects", () => {
      const original = JSON.stringify({ id: "u1", name: "Alice", avatar: "" });
      const rows = [{ contributor: original }];
      service.anonymizeRows(rows, [contributorColumn], {
        id: "exp-1",
        anonymizeContributors: true,
      });
      expect(rows[0].contributor).toBe(original);
    });
  });

  describe("anonymizeDistinctValues", () => {
    const contributorStruct = (id: string, name: string) =>
      JSON.stringify({ id, name, avatar: "https://a" });

    it("passes values through untouched when the flag is off", () => {
      const values = [contributorStruct("u1", "Alice")];
      const out = service.anonymizeDistinctValues(values, WellKnownColumnTypes.CONTRIBUTOR, {
        id: "exp-1",
        anonymizeContributors: false,
      });
      expect(out).toBe(values);
    });

    it("passes values through untouched for a non-contributor column", () => {
      const values = ["alpha", "beta"];
      const out = service.anonymizeDistinctValues(values, "STRING", {
        id: "exp-1",
        anonymizeContributors: true,
      });
      expect(out).toBe(values);
    });

    it("pseudonymises id, name and avatar (full parity with anonymizeRows)", () => {
      const values = [contributorStruct("u1", "Alice")];
      const [out] = service.anonymizeDistinctValues(values, WellKnownColumnTypes.CONTRIBUTOR, {
        id: "exp-1",
        anonymizeContributors: true,
      });
      if (typeof out !== "string") throw new Error("expected serialized contributor");
      const parsed = JSON.parse(out) as { id: string; name: string; avatar: string | null };
      const pseudo = service.pseudonymFor("exp-1", "u1");
      // id is pseudonymised too; the data read translates it back to match raw rows.
      expect(parsed.id).toBe(pseudo);
      expect(parsed.name).toBe(pseudo);
      expect(parsed.id).not.toBe("u1");
      expect(parsed.avatar).toBeNull();
    });
  });
});
