import { eq, macros, protocolMacros, sql } from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { MacroRepository } from "./macro.repository";

describe("MacroRepository explicit sorting", () => {
  const testApp = TestHarness.App;
  let repository: MacroRepository;
  let owner: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(MacroRepository);
    owner = await testApp.createTestUser({});
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function setUpdatedAt(id: string, iso: string) {
    await testApp.database
      .update(macros)
      .set({ updatedAt: new Date(iso) })
      .where(eq(macros.id, id));
  }

  // Names run against id order, so a result in name order cannot come from the id tiebreak.
  async function nameAgainstIdOrder(ids: string[]) {
    const expected = [...ids].sort().reverse();
    for (const [index, id] of expected.entries()) {
      await testApp.database
        .update(macros)
        .set({ name: `Tie ${String.fromCharCode(65 + index)}` })
        .where(eq(macros.id, id));
    }
    return expected;
  }

  async function linkProtocols(macroId: string, count: number) {
    for (let index = 0; index < count; index += 1) {
      const protocol = await testApp.createProtocol({
        name: `Linked protocol ${crypto.randomUUID()}`,
        createdBy: owner,
      });
      await testApp.database.insert(protocolMacros).values({ protocolId: protocol.id, macroId });
    }
  }

  it("sorts every field in both directions, including the protocol count", async () => {
    const alpha = await testApp.createMacro({
      name: "Alpha Macro",
      language: "r",
      createdBy: owner,
      visibility: "public",
    });
    const bravo = await testApp.createMacro({
      name: "Bravo Macro",
      language: "javascript",
      createdBy: owner,
      visibility: "public",
    });
    const charlie = await testApp.createMacro({
      name: "Charlie Macro",
      language: "python",
      createdBy: owner,
      visibility: "public",
    });
    await setUpdatedAt(alpha.id, "2025-01-03T00:00:00Z");
    await setUpdatedAt(bravo.id, "2025-01-01T00:00:00Z");
    await setUpdatedAt(charlie.id, "2025-01-02T00:00:00Z");
    await linkProtocols(bravo.id, 1);
    await linkProtocols(charlie.id, 2);

    // Language sorts by label, not by the enum's declaration order (python, r, javascript).
    const expected = {
      name: [alpha.id, bravo.id, charlie.id],
      language: [bravo.id, charlie.id, alpha.id],
      protocols: [alpha.id, bravo.id, charlie.id],
      updated: [bravo.id, charlie.id, alpha.id],
    } as const;

    for (const field of ["name", "language", "protocols", "updated"] as const) {
      const ascending = await repository.findAll({
        userId: owner,
        sort: [{ field, direction: "asc" }],
      });
      const descending = await repository.findAll({
        userId: owner,
        sort: [{ field, direction: "desc" }],
      });
      assertSuccess(ascending);
      assertSuccess(descending);

      expect(
        ascending.value.map((macro) => macro.id),
        `${field} ascending`,
      ).toEqual(expected[field]);
      expect(
        descending.value.map((macro) => macro.id),
        `${field} descending`,
      ).toEqual([...expected[field]].reverse());
    }
  });

  it("can use an index for the protocol-count sort lookup", async () => {
    const plan = await testApp.database.transaction(async (transaction) => {
      await transaction.execute(sql`SET LOCAL enable_seqscan = off`);
      return transaction.execute(sql`
        EXPLAIN (FORMAT JSON)
        SELECT count(*) FROM protocol_macros WHERE macro_id = ${crypto.randomUUID()}::uuid
      `);
    });

    expect(JSON.stringify(plan)).toContain("protocol_macros_macro_id_idx");
  });

  it("applies a secondary sort within ties of the first", async () => {
    const zulu = await testApp.createMacro({
      name: "Zulu",
      language: "python",
      createdBy: owner,
      visibility: "public",
    });
    const alpha = await testApp.createMacro({
      name: "Alpha",
      language: "python",
      createdBy: owner,
      visibility: "public",
    });
    const mike = await testApp.createMacro({
      name: "Mike",
      language: "r",
      createdBy: owner,
      visibility: "public",
    });

    const result = await repository.findAll({
      userId: owner,
      sort: [
        { field: "language", direction: "asc" },
        { field: "name", direction: "desc" },
      ],
    });

    assertSuccess(result);
    expect(result.value.map((macro) => macro.id)).toEqual([zulu.id, alpha.id, mike.id]);
  });

  it("replaces the preferred order and search relevance", async () => {
    const preferred = await testApp.createMacro({
      name: "Zeta shared",
      description: "shared term shared term",
      createdBy: owner,
      visibility: "public",
    });
    await testApp.createMacro({
      name: "Alpha shared",
      description: "shared",
      createdBy: owner,
      visibility: "public",
    });
    await testApp.database.update(macros).set({ sortOrder: 1 }).where(eq(macros.id, preferred.id));

    const sort = [{ field: "name", direction: "asc" }] as const;
    const browse = await repository.findPage(1, 20, { userId: owner, sort: [...sort] });
    const search = await repository.findPage(1, 20, {
      search: "shared",
      userId: owner,
      sort: [...sort],
    });
    const unsorted = await repository.findPage(1, 20, { userId: owner });

    assertSuccess(browse);
    assertSuccess(search);
    assertSuccess(unsorted);
    expect(browse.value.items.map((macro) => macro.name)).toEqual(["Alpha shared", "Zeta shared"]);
    expect(search.value.items.map((macro) => macro.name)).toEqual(["Alpha shared", "Zeta shared"]);
    // Without an explicit sort the preferred macro still leads.
    expect(unsorted.value.items[0]?.id).toBe(preferred.id);
  });

  it("breaks count ties by the default order so pages never repeat or skip a row", async () => {
    const created = await Promise.all(
      ["Tie one", "Tie two", "Tie three"].map((name) =>
        testApp.createMacro({ name, createdBy: owner, visibility: "public" }),
      ),
    );
    const expected = await nameAgainstIdOrder(created.map((macro) => macro.id));
    const filter = { userId: owner, sort: [{ field: "protocols", direction: "asc" }] } as const;

    const [first, second] = await Promise.all([
      repository.findPage(1, 2, { ...filter, sort: [...filter.sort] }),
      repository.findPage(2, 2, { ...filter, sort: [...filter.sort] }),
    ]);

    assertSuccess(first);
    assertSuccess(second);
    const ids = [...first.value.items, ...second.value.items].map((macro) => macro.id);
    expect(ids).toEqual(expected);
    expect(first.value.totalCount).toBe(created.length);
  });

  it("returns only accessible protocols in paginated counts and count sorting", async () => {
    const privateOwner = await testApp.createTestUser({});
    const hiddenLinks = await testApp.createMacro({
      name: "Alpha hidden links",
      createdBy: owner,
      visibility: "public",
    });
    const publicLink = await testApp.createMacro({
      name: "Bravo public link",
      createdBy: owner,
      visibility: "public",
    });
    const unlinked = await testApp.createMacro({
      name: "Charlie unlinked",
      createdBy: owner,
      visibility: "public",
    });
    for (let index = 0; index < 2; index += 1) {
      const linked = await testApp.createProtocol({
        name: `Private linked protocol ${index}`,
        createdBy: privateOwner,
        visibility: "private",
      });
      await testApp.database.insert(protocolMacros).values({
        macroId: hiddenLinks.id,
        protocolId: linked.id,
      });
    }
    const visible = await testApp.createProtocol({
      name: "Public linked protocol",
      createdBy: privateOwner,
      visibility: "public",
    });
    await testApp.database.insert(protocolMacros).values({
      macroId: publicLink.id,
      protocolId: visible.id,
    });

    for (const userId of [owner, undefined, privateOwner]) {
      for (const direction of ["asc", "desc"] as const) {
        const result = await repository.findPage(1, 20, {
          userId,
          sort: [{ field: "protocols", direction }],
        });
        assertSuccess(result);
        const ascending =
          userId === privateOwner
            ? [
                [unlinked.id, 0],
                [publicLink.id, 1],
                [hiddenLinks.id, 2],
              ]
            : [
                [hiddenLinks.id, 0],
                [unlinked.id, 0],
                [publicLink.id, 1],
              ];
        const descending =
          userId === privateOwner
            ? [
                [hiddenLinks.id, 2],
                [publicLink.id, 1],
                [unlinked.id, 0],
              ]
            : [
                [publicLink.id, 1],
                [hiddenLinks.id, 0],
                [unlinked.id, 0],
              ];
        const expected = direction === "asc" ? ascending : descending;
        expect(result.value.items.map((item) => [item.id, item.compatibleProtocolCount])).toEqual(
          expected,
        );
        expect(result.value.totalCount).toBe(3);
      }
    }
  });

  describe("activity sort", () => {
    it("puts a macro with no activity total last in both directions", async () => {
      const active = await testApp.createMacro({
        name: "Active macro",
        createdBy: owner,
        visibility: "public",
      });
      const none = await testApp.createMacro({
        name: "No activity macro",
        createdBy: owner,
        visibility: "public",
      });
      const totals = new Map([[active.id, 7]]);

      const ascending = await repository.findAll(
        { userId: owner, sort: [{ field: "activity", direction: "asc" }] },
        undefined,
        totals,
      );
      const descending = await repository.findAll(
        { userId: owner, sort: [{ field: "activity", direction: "desc" }] },
        undefined,
        totals,
      );

      assertSuccess(ascending);
      assertSuccess(descending);
      expect(ascending.value.map((macro) => macro.id)).toEqual([active.id, none.id]);
      expect(descending.value.map((macro) => macro.id)).toEqual([active.id, none.id]);
    });

    it("orders by activity whether it is the first or the second sort key", async () => {
      const zulu = await testApp.createMacro({
        name: "Zulu",
        createdBy: owner,
        visibility: "public",
      });
      const alpha = await testApp.createMacro({
        name: "Alpha",
        createdBy: owner,
        visibility: "public",
      });
      const mike = await testApp.createMacro({
        name: "Mike",
        createdBy: owner,
        visibility: "public",
      });
      // zulu and alpha tie on activity; mike trails both.
      const totals = new Map([
        [zulu.id, 10],
        [alpha.id, 10],
        [mike.id, 1],
      ]);

      const activityThenName = await repository.findAll(
        {
          userId: owner,
          sort: [
            { field: "activity", direction: "desc" },
            { field: "name", direction: "asc" },
          ],
        },
        undefined,
        totals,
      );
      const nameThenActivity = await repository.findAll(
        {
          userId: owner,
          sort: [
            { field: "name", direction: "asc" },
            { field: "activity", direction: "desc" },
          ],
        },
        undefined,
        totals,
      );

      assertSuccess(activityThenName);
      assertSuccess(nameThenActivity);
      expect(activityThenName.value.map((macro) => macro.id)).toEqual([alpha.id, zulu.id, mike.id]);
      expect(nameThenActivity.value.map((macro) => macro.id)).toEqual([alpha.id, mike.id, zulu.id]);
    });

    it("never repeats or drops a row across pages when many totals tie", async () => {
      const created = await Promise.all(
        ["Tie one", "Tie two", "Tie three", "Tie four"].map((name) =>
          testApp.createMacro({ name, createdBy: owner, visibility: "public" }),
        ),
      );
      const expected = await nameAgainstIdOrder(created.map((macro) => macro.id));
      const totals = new Map(created.map((macro) => [macro.id, 5]));
      const sort = [{ field: "activity", direction: "desc" }] as const;

      const [first, second] = await Promise.all([
        repository.findPage(1, 2, { userId: owner, sort: [...sort] }, totals),
        repository.findPage(2, 2, { userId: owner, sort: [...sort] }, totals),
      ]);

      assertSuccess(first);
      assertSuccess(second);
      const ids = [...first.value.items, ...second.value.items].map((macro) => macro.id);
      expect(ids).toEqual(expected);
      expect(new Set(ids).size).toBe(created.length);
      expect(first.value.totalCount).toBe(created.length);
    });

    it("does not change the page count when sorting by activity", async () => {
      const created = await Promise.all(
        ["Count one", "Count two", "Count three"].map((name) =>
          testApp.createMacro({ name, createdBy: owner, visibility: "public" }),
        ),
      );
      const totals = new Map([[created[0].id, 3]]);

      const withActivity = await repository.findPage(
        1,
        1,
        { userId: owner, sort: [{ field: "activity", direction: "desc" }] },
        totals,
      );
      const withoutActivity = await repository.findPage(1, 1, { userId: owner });

      assertSuccess(withActivity);
      assertSuccess(withoutActivity);
      expect(withActivity.value.totalCount).toBe(created.length);
      expect(withActivity.value.totalCount).toBe(withoutActivity.value.totalCount);
    });

    it("ignores activity totals entirely when the sort does not include activity", async () => {
      const alpha = await testApp.createMacro({
        name: "Alpha",
        createdBy: owner,
        visibility: "public",
      });
      const bravo = await testApp.createMacro({
        name: "Bravo",
        createdBy: owner,
        visibility: "public",
      });
      // Out of int4 range: if this were joined anyway, the query would fail to
      // bind it rather than silently ignore it, so success here is itself proof
      // that a non-activity sort never triggers the join.
      const totals = new Map([[bravo.id, Number.MAX_SAFE_INTEGER]]);

      const result = await repository.findAll(
        { userId: owner, sort: [{ field: "name", direction: "asc" }] },
        undefined,
        totals,
      );

      assertSuccess(result);
      expect(result.value.map((macro) => macro.id)).toEqual([alpha.id, bravo.id]);
    });

    it("accepts an empty totals map, treating every row as having no activity", async () => {
      const created = await Promise.all(
        ["Empty one", "Empty two", "Empty three"].map((name) =>
          testApp.createMacro({ name, createdBy: owner, visibility: "public" }),
        ),
      );
      const expected = await nameAgainstIdOrder(created.map((macro) => macro.id));
      const empty = new Map<string, number>();

      const result = await repository.findAll(
        { userId: owner, sort: [{ field: "activity", direction: "desc" }] },
        undefined,
        empty,
      );

      assertSuccess(result);
      expect(result.value.map((macro) => macro.id)).toEqual(expected);
    });
  });
});
