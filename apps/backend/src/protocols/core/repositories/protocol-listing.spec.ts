import { eq, protocolMacros, protocols } from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { ProtocolRepository } from "./protocol.repository";

describe("ProtocolRepository explicit sorting", () => {
  const testApp = TestHarness.App;
  let repository: ProtocolRepository;
  let owner: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ProtocolRepository);
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
      .update(protocols)
      .set({ updatedAt: new Date(iso) })
      .where(eq(protocols.id, id));
  }

  // Names run against id order, so a result in name order cannot come from the id tiebreak.
  async function nameAgainstIdOrder(ids: string[]) {
    const expected = [...ids].sort().reverse();
    for (const [index, id] of expected.entries()) {
      await testApp.database
        .update(protocols)
        .set({ name: `Tie ${String.fromCharCode(65 + index)}` })
        .where(eq(protocols.id, id));
    }
    return expected;
  }

  async function linkMacros(protocolId: string, count: number) {
    for (let index = 0; index < count; index += 1) {
      const macro = await testApp.createMacro({
        name: `Linked macro ${crypto.randomUUID()}`,
        createdBy: owner,
      });
      await testApp.database.insert(protocolMacros).values({ protocolId, macroId: macro.id });
    }
  }

  it("sorts every field in both directions, including the macro count", async () => {
    const alpha = await testApp.createProtocol({
      name: "Alpha Protocol",
      family: "generic",
      createdBy: owner,
      visibility: "public",
    });
    const bravo = await testApp.createProtocol({
      name: "Bravo Protocol",
      family: "ambyte",
      createdBy: owner,
      visibility: "public",
    });
    const charlie = await testApp.createProtocol({
      name: "Charlie Protocol",
      family: "minipar",
      createdBy: owner,
      visibility: "public",
    });
    await setUpdatedAt(alpha.id, "2025-01-03T00:00:00Z");
    await setUpdatedAt(bravo.id, "2025-01-01T00:00:00Z");
    await setUpdatedAt(charlie.id, "2025-01-02T00:00:00Z");
    await linkMacros(bravo.id, 1);
    await linkMacros(charlie.id, 2);

    // Family sorts by label, not by the enum's declaration order (multispeq, ambyte, minipar, generic).
    const expected = {
      name: [alpha.id, bravo.id, charlie.id],
      family: [bravo.id, alpha.id, charlie.id],
      macros: [alpha.id, bravo.id, charlie.id],
      updated: [bravo.id, charlie.id, alpha.id],
    } as const;

    for (const field of ["name", "family", "macros", "updated"] as const) {
      const ascending = await repository.findAll(
        undefined,
        undefined,
        owner,
        undefined,
        undefined,
        [{ field, direction: "asc" }],
      );
      const descending = await repository.findAll(
        undefined,
        undefined,
        owner,
        undefined,
        undefined,
        [{ field, direction: "desc" }],
      );
      assertSuccess(ascending);
      assertSuccess(descending);

      expect(
        ascending.value.map((protocol) => protocol.id),
        `${field} ascending`,
      ).toEqual(expected[field]);
      expect(
        descending.value.map((protocol) => protocol.id),
        `${field} descending`,
      ).toEqual([...expected[field]].reverse());
    }
  });

  it("applies a secondary sort within ties of the first", async () => {
    const zulu = await testApp.createProtocol({
      name: "Zulu",
      family: "ambyte",
      createdBy: owner,
      visibility: "public",
    });
    const alpha = await testApp.createProtocol({
      name: "Alpha",
      family: "ambyte",
      createdBy: owner,
      visibility: "public",
    });
    const mike = await testApp.createProtocol({
      name: "Mike",
      family: "generic",
      createdBy: owner,
      visibility: "public",
    });

    const result = await repository.findAll(undefined, undefined, owner, undefined, undefined, [
      { field: "family", direction: "asc" },
      { field: "name", direction: "desc" },
    ]);

    assertSuccess(result);
    expect(result.value.map((protocol) => protocol.id)).toEqual([zulu.id, alpha.id, mike.id]);
  });

  it("replaces the preferred order and search relevance", async () => {
    const preferred = await testApp.createProtocol({
      name: "Zeta shared",
      description: "shared term shared term",
      createdBy: owner,
      visibility: "public",
    });
    await testApp.createProtocol({
      name: "Alpha shared",
      description: "shared",
      createdBy: owner,
      visibility: "public",
    });
    await testApp.database
      .update(protocols)
      .set({ sortOrder: 1 })
      .where(eq(protocols.id, preferred.id));

    const browse = await repository.findPage(1, 20, undefined, undefined, owner, undefined, [
      { field: "name", direction: "asc" },
    ]);
    const search = await repository.findPage(1, 20, "shared", undefined, owner, undefined, [
      { field: "name", direction: "asc" },
    ]);
    const unsorted = await repository.findPage(1, 20, undefined, undefined, owner);

    assertSuccess(browse);
    assertSuccess(search);
    assertSuccess(unsorted);
    expect(browse.value.items.map((protocol) => protocol.name)).toEqual([
      "Alpha shared",
      "Zeta shared",
    ]);
    expect(search.value.items.map((protocol) => protocol.name)).toEqual([
      "Alpha shared",
      "Zeta shared",
    ]);
    // Without an explicit sort the preferred protocol still leads.
    expect(unsorted.value.items[0]?.id).toBe(preferred.id);
  });

  it("breaks count ties by the default order so pages never repeat or skip a row", async () => {
    const created = await Promise.all(
      ["Tie one", "Tie two", "Tie three"].map((name) =>
        testApp.createProtocol({ name, createdBy: owner, visibility: "public" }),
      ),
    );
    const expected = await nameAgainstIdOrder(created.map((protocol) => protocol.id));
    const sort = [{ field: "macros", direction: "asc" }] as const;

    const [first, second] = await Promise.all([
      repository.findPage(1, 2, undefined, undefined, owner, undefined, [...sort]),
      repository.findPage(2, 2, undefined, undefined, owner, undefined, [...sort]),
    ]);

    assertSuccess(first);
    assertSuccess(second);
    const ids = [...first.value.items, ...second.value.items].map((protocol) => protocol.id);
    expect(ids).toEqual(expected);
    expect(first.value.totalCount).toBe(created.length);
  });

  it("does not count macros linked to other protocols", async () => {
    const linked = await testApp.createProtocol({
      name: "Linked",
      createdBy: owner,
      visibility: "public",
    });
    const unlinked = await testApp.createProtocol({
      name: "Unlinked",
      createdBy: owner,
      visibility: "public",
    });
    await linkMacros(linked.id, 1);

    const result = await repository.findAll(undefined, undefined, owner, undefined, undefined, [
      { field: "macros", direction: "desc" },
    ]);

    assertSuccess(result);
    expect(result.value.map((protocol) => protocol.id)).toEqual([linked.id, unlinked.id]);
  });

  describe("family and visibility filters", () => {
    async function createListingFixtures() {
      const other = await testApp.createTestUser({});
      const ambyte = await testApp.createProtocol({
        name: "Ambyte public",
        family: "ambyte",
        createdBy: owner,
        visibility: "public",
      });
      const multispeq = await testApp.createProtocol({
        name: "MultispeQ public",
        family: "multispeq",
        createdBy: owner,
        visibility: "public",
      });
      const minipar = await testApp.createProtocol({
        name: "MiniPAR private",
        family: "minipar",
        createdBy: owner,
        visibility: "private",
      });
      const othersAmbyte = await testApp.createProtocol({
        name: "Zeta ambyte public",
        family: "ambyte",
        createdBy: other,
        visibility: "public",
      });
      const othersPrivate = await testApp.createProtocol({
        name: "Zeta ambyte private",
        family: "ambyte",
        createdBy: other,
        visibility: "private",
      });
      return { ambyte, multispeq, minipar, othersAmbyte, othersPrivate };
    }

    async function listIds(
      filter: Parameters<ProtocolRepository["findAll"]>[6],
      options: { search?: string; scope?: "all" | "related" } = {},
    ) {
      const result = await repository.findAll(
        options.search,
        options.scope,
        owner,
        undefined,
        undefined,
        [{ field: "name", direction: "asc" }],
        filter,
      );
      assertSuccess(result);
      return result.value.map((protocol) => protocol.id);
    }

    it("keeps only the picked family, and matches either of two", async () => {
      const { ambyte, multispeq, othersAmbyte } = await createListingFixtures();

      expect(await listIds({ families: ["ambyte"] })).toEqual([ambyte.id, othersAmbyte.id]);
      expect(await listIds({ families: ["ambyte", "multispeq"] })).toEqual([
        ambyte.id,
        multispeq.id,
        othersAmbyte.id,
      ]);
    });

    it("keeps only the picked visibility, and never shows someone else's private protocol", async () => {
      const { ambyte, multispeq, minipar, othersAmbyte, othersPrivate } =
        await createListingFixtures();

      const privateIds = await listIds({ visibilities: ["private"] });
      expect(privateIds).toEqual([minipar.id]);
      expect(privateIds).not.toContain(othersPrivate.id);
      expect(await listIds({ visibilities: ["public"] })).toEqual([
        ambyte.id,
        multispeq.id,
        othersAmbyte.id,
      ]);
    });

    it("treats empty lists as no filter", async () => {
      const { ambyte, multispeq, minipar, othersAmbyte } = await createListingFixtures();

      expect(await listIds({ families: [], visibilities: [] })).toEqual([
        ambyte.id,
        minipar.id,
        multispeq.id,
        othersAmbyte.id,
      ]);
    });

    it("requires both filters to match when both are set", async () => {
      const { minipar } = await createListingFixtures();

      expect(await listIds({ families: ["ambyte"], visibilities: ["private"] })).toEqual([]);
      expect(await listIds({ families: ["ambyte", "minipar"], visibilities: ["private"] })).toEqual(
        [minipar.id],
      );
    });

    it("combines with search and with the related scope", async () => {
      const { ambyte, othersAmbyte } = await createListingFixtures();

      expect(await listIds({ families: ["ambyte"] }, { search: "Zeta" })).toEqual([
        othersAmbyte.id,
      ]);
      expect(await listIds({ families: ["ambyte"] }, { scope: "related" })).toEqual([ambyte.id]);
    });

    it("counts only the filtered rows in a page's total", async () => {
      const { ambyte } = await createListingFixtures();

      const result = await repository.findPage(
        1,
        1,
        undefined,
        undefined,
        owner,
        undefined,
        [{ field: "name", direction: "asc" }],
        { families: ["ambyte"] },
      );

      assertSuccess(result);
      expect(result.value.items.map((protocol) => protocol.id)).toEqual([ambyte.id]);
      expect(result.value.totalCount).toBe(2);
    });
  });

  describe("activity sort", () => {
    it("puts a protocol with no activity total last in both directions", async () => {
      const active = await testApp.createProtocol({
        name: "Active protocol",
        createdBy: owner,
        visibility: "public",
      });
      const none = await testApp.createProtocol({
        name: "No activity protocol",
        createdBy: owner,
        visibility: "public",
      });
      const totals = new Map([[active.id, 7]]);

      const ascending = await repository.findAll(
        undefined,
        undefined,
        owner,
        undefined,
        undefined,
        [{ field: "activity", direction: "asc" }],
        undefined,
        totals,
      );
      const descending = await repository.findAll(
        undefined,
        undefined,
        owner,
        undefined,
        undefined,
        [{ field: "activity", direction: "desc" }],
        undefined,
        totals,
      );

      assertSuccess(ascending);
      assertSuccess(descending);
      expect(ascending.value.map((protocol) => protocol.id)).toEqual([active.id, none.id]);
      expect(descending.value.map((protocol) => protocol.id)).toEqual([active.id, none.id]);
    });

    it("orders by activity whether it is the first or the second sort key", async () => {
      const zulu = await testApp.createProtocol({
        name: "Zulu",
        createdBy: owner,
        visibility: "public",
      });
      const alpha = await testApp.createProtocol({
        name: "Alpha",
        createdBy: owner,
        visibility: "public",
      });
      const mike = await testApp.createProtocol({
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
        undefined,
        undefined,
        owner,
        undefined,
        undefined,
        [
          { field: "activity", direction: "desc" },
          { field: "name", direction: "asc" },
        ],
        undefined,
        totals,
      );
      const nameThenActivity = await repository.findAll(
        undefined,
        undefined,
        owner,
        undefined,
        undefined,
        [
          { field: "name", direction: "asc" },
          { field: "activity", direction: "desc" },
        ],
        undefined,
        totals,
      );

      assertSuccess(activityThenName);
      assertSuccess(nameThenActivity);
      expect(activityThenName.value.map((protocol) => protocol.id)).toEqual([
        alpha.id,
        zulu.id,
        mike.id,
      ]);
      expect(nameThenActivity.value.map((protocol) => protocol.id)).toEqual([
        alpha.id,
        mike.id,
        zulu.id,
      ]);
    });

    it("never repeats or drops a row across pages when many totals tie", async () => {
      const created = await Promise.all(
        ["Tie one", "Tie two", "Tie three", "Tie four"].map((name) =>
          testApp.createProtocol({ name, createdBy: owner, visibility: "public" }),
        ),
      );
      const expected = await nameAgainstIdOrder(created.map((protocol) => protocol.id));
      const totals = new Map(created.map((protocol) => [protocol.id, 5]));
      const sort = [{ field: "activity", direction: "desc" }] as const;

      const [first, second] = await Promise.all([
        repository.findPage(
          1,
          2,
          undefined,
          undefined,
          owner,
          undefined,
          [...sort],
          undefined,
          totals,
        ),
        repository.findPage(
          2,
          2,
          undefined,
          undefined,
          owner,
          undefined,
          [...sort],
          undefined,
          totals,
        ),
      ]);

      assertSuccess(first);
      assertSuccess(second);
      const ids = [...first.value.items, ...second.value.items].map((protocol) => protocol.id);
      expect(ids).toEqual(expected);
      expect(new Set(ids).size).toBe(created.length);
      expect(first.value.totalCount).toBe(created.length);
    });

    it("does not change the page count when sorting by activity", async () => {
      const created = await Promise.all(
        ["Count one", "Count two", "Count three"].map((name) =>
          testApp.createProtocol({ name, createdBy: owner, visibility: "public" }),
        ),
      );
      const totals = new Map([[created[0].id, 3]]);

      const withActivity = await repository.findPage(
        1,
        1,
        undefined,
        undefined,
        owner,
        undefined,
        [{ field: "activity", direction: "desc" }],
        undefined,
        totals,
      );
      const withoutActivity = await repository.findPage(1, 1, undefined, undefined, owner);

      assertSuccess(withActivity);
      assertSuccess(withoutActivity);
      expect(withActivity.value.totalCount).toBe(created.length);
      expect(withActivity.value.totalCount).toBe(withoutActivity.value.totalCount);
    });

    it("ignores activity totals entirely when the sort does not include activity", async () => {
      const alpha = await testApp.createProtocol({
        name: "Alpha",
        createdBy: owner,
        visibility: "public",
      });
      const bravo = await testApp.createProtocol({
        name: "Bravo",
        createdBy: owner,
        visibility: "public",
      });
      // Out of int4 range: if this were joined anyway, the query would fail to
      // bind it rather than silently ignore it, so success here is itself proof
      // that a non-activity sort never triggers the join.
      const totals = new Map([[bravo.id, Number.MAX_SAFE_INTEGER]]);

      const result = await repository.findAll(
        undefined,
        undefined,
        owner,
        undefined,
        undefined,
        [{ field: "name", direction: "asc" }],
        undefined,
        totals,
      );

      assertSuccess(result);
      expect(result.value.map((protocol) => protocol.id)).toEqual([alpha.id, bravo.id]);
    });

    it("accepts an empty totals map, treating every row as having no activity", async () => {
      const created = await Promise.all(
        ["Empty one", "Empty two", "Empty three"].map((name) =>
          testApp.createProtocol({ name, createdBy: owner, visibility: "public" }),
        ),
      );
      const expected = await nameAgainstIdOrder(created.map((protocol) => protocol.id));
      const empty = new Map<string, number>();

      const result = await repository.findAll(
        undefined,
        undefined,
        owner,
        undefined,
        undefined,
        [{ field: "activity", direction: "desc" }],
        undefined,
        empty,
      );

      assertSuccess(result);
      // Every row ties at "no activity", so the default order decides.
      expect(result.value.map((protocol) => protocol.id)).toEqual(expected);
    });
  });
});
