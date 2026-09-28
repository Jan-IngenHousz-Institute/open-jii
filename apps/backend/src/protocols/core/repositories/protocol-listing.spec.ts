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

  it("breaks count ties by ID so pages never repeat or skip a row", async () => {
    const created = await Promise.all(
      ["Tie one", "Tie two", "Tie three"].map((name) =>
        testApp.createProtocol({ name, createdBy: owner, visibility: "public" }),
      ),
    );
    const sort = [{ field: "macros", direction: "asc" }] as const;

    const [first, second] = await Promise.all([
      repository.findPage(1, 2, undefined, undefined, owner, undefined, [...sort]),
      repository.findPage(2, 2, undefined, undefined, owner, undefined, [...sort]),
    ]);

    assertSuccess(first);
    assertSuccess(second);
    const ids = [...first.value.items, ...second.value.items].map((protocol) => protocol.id);
    expect(ids).toEqual(created.map((protocol) => protocol.id).sort());
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
});
