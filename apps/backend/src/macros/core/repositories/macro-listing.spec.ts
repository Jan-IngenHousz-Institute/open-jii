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

  it("breaks count ties by ID so pages never repeat or skip a row", async () => {
    const created = await Promise.all(
      ["Tie one", "Tie two", "Tie three"].map((name) =>
        testApp.createMacro({ name, createdBy: owner, visibility: "public" }),
      ),
    );
    const filter = { userId: owner, sort: [{ field: "protocols", direction: "asc" }] } as const;

    const [first, second] = await Promise.all([
      repository.findPage(1, 2, { ...filter, sort: [...filter.sort] }),
      repository.findPage(2, 2, { ...filter, sort: [...filter.sort] }),
    ]);

    assertSuccess(first);
    assertSuccess(second);
    const ids = [...first.value.items, ...second.value.items].map((macro) => macro.id);
    expect(ids).toEqual(created.map((macro) => macro.id).sort());
    expect(first.value.totalCount).toBe(created.length);
  });
});
