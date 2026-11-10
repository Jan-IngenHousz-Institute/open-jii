import { eq, experiments, profiles, workbooks } from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { WorkbookRepository } from "./workbook.repository";

/**
 * `scope=related` and paging, the two contract changes OJD-1728 adds. Workbooks stand in
 * for protocols and macros here: all three moved from bare authorship to the shared
 * relationship predicate, and all three page through the same helper.
 */
describe("WorkbookRepository listing scope and pagination", () => {
  const testApp = TestHarness.App;
  let repository: WorkbookRepository;
  let owner: string;
  let stranger: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(WorkbookRepository);
    owner = await testApp.createTestUser({});
    stranger = await testApp.createTestUser({});
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  // Names run against id order, so a result in name order cannot come from the id tiebreak.
  async function nameAgainstIdOrder(ids: string[]) {
    const expected = [...ids].sort().reverse();
    for (const [index, id] of expected.entries()) {
      await testApp.database
        .update(workbooks)
        .set({ name: `Tie ${String.fromCharCode(65 + index)}` })
        .where(eq(workbooks.id, id));
    }
    return expected;
  }

  describe("scope=related", () => {
    it("counts a shared workbook the caller did not author", async () => {
      const orgId = await testApp.createOrganization();
      await testApp.addOrganizationMember(orgId, owner, "owner");
      const shared = await testApp.createWorkbook({
        name: "Shared with me",
        createdBy: owner,
        visibility: "private",
        organizationId: orgId,
      });
      await testApp.addResourceGrant({
        resourceType: "workbook",
        resourceId: shared.id,
        granteeType: "user",
        granteeId: stranger,
        role: "viewer",
      });

      const result = await repository.findAll({ scope: "related", userId: stranger });

      assertSuccess(result);
      // The semantic upgrade: bare `created_by` would have dropped this row.
      expect(result.value.map((w) => w.id)).toContain(shared.id);
    });

    it("counts a workbook reached through membership of its owning organization", async () => {
      const orgId = await testApp.createOrganization();
      await testApp.addOrganizationMember(orgId, owner, "owner");
      await testApp.addOrganizationMember(orgId, stranger, "member");
      const orgWorkbook = await testApp.createWorkbook({
        name: "Team workbook",
        createdBy: owner,
        visibility: "private",
        organizationId: orgId,
      });

      const result = await repository.findAll({ scope: "related", userId: stranger });

      assertSuccess(result);
      expect(result.value.map((w) => w.id)).toContain(orgWorkbook.id);
    });

    it("drops a public workbook the caller is merely able to read", async () => {
      const theirs = await testApp.createWorkbook({
        name: "Public elsewhere",
        createdBy: owner,
        visibility: "public",
      });

      const related = await repository.findAll({ scope: "related", userId: stranger });
      const all = await repository.findAll({ scope: "all", userId: stranger });

      assertSuccess(related);
      assertSuccess(all);
      expect(related.value.map((w) => w.id)).not.toContain(theirs.id);
      expect(all.value.map((w) => w.id)).toContain(theirs.id);
    });

    it("admits nothing without a caller, rather than throwing", async () => {
      await testApp.createWorkbook({ name: "Public one", createdBy: owner, visibility: "public" });

      const result = await repository.findAll({ scope: "related" });

      assertSuccess(result);
      expect(result.value).toEqual([]);
    });
  });

  describe("findPage", () => {
    beforeEach(async () => {
      for (const name of ["Alpha", "Bravo", "Charlie", "Delta", "Echo"]) {
        await testApp.createWorkbook({ name, createdBy: owner, visibility: "public" });
      }
    });

    it("returns one page alongside the totals for the whole set", async () => {
      const result = await repository.findPage(1, 2, { userId: owner });

      assertSuccess(result);
      expect(result.value.items.map((w) => w.name)).toEqual(["Alpha", "Bravo"]);
      expect(result.value.totalCount).toBe(5);
    });

    it("walks pages without dropping or repeating a row", async () => {
      const [first, second, third] = await Promise.all([
        repository.findPage(1, 2, { userId: owner }),
        repository.findPage(2, 2, { userId: owner }),
        repository.findPage(3, 2, { userId: owner }),
      ]);

      assertSuccess(first);
      assertSuccess(second);
      assertSuccess(third);
      const seen = [...first.value.items, ...second.value.items, ...third.value.items].map(
        (w) => w.name,
      );
      expect(seen).toEqual(["Alpha", "Bravo", "Charlie", "Delta", "Echo"]);
    });

    it("reports the real totals for a page past the end instead of failing", async () => {
      const result = await repository.findPage(99, 20, { userId: owner });

      assertSuccess(result);
      expect(result.value.items).toEqual([]);
      expect(result.value.totalCount).toBe(5);
    });

    it("counts the scoped set, not the whole table", async () => {
      const result = await repository.findPage(1, 20, { scope: "related", userId: stranger });

      assertSuccess(result);
      expect(result.value.totalCount).toBe(0);
    });
  });

  /**
   * Search orders by `score DESC, id ASC`, and identically-worded rows score
   * identically, so it is the ordering most exposed to ties. Without the `id`
   * tiebreak the pages below could overlap or skip rows.
   */
  describe("findPage over the search ordering", () => {
    const TIED = 6;

    beforeEach(async () => {
      for (let i = 0; i < TIED; i++) {
        await testApp.createWorkbook({
          name: `Tiebreak probe ${i}`,
          description: "identical scoring text",
          createdBy: owner,
          visibility: "public",
        });
      }
    });

    it("walks tied rows without dropping or repeating any", async () => {
      const filter = { search: "tiebreak", userId: owner };

      const [first, second, third] = await Promise.all([
        repository.findPage(1, 2, filter),
        repository.findPage(2, 2, filter),
        repository.findPage(3, 2, filter),
      ]);

      assertSuccess(first);
      assertSuccess(second);
      assertSuccess(third);

      const ids = [...first.value.items, ...second.value.items, ...third.value.items].map(
        (w) => w.id,
      );
      expect(ids).toHaveLength(TIED);
      expect(new Set(ids).size).toBe(TIED);
      expect(first.value.totalCount).toBe(TIED);

      // The rows tie on score, so `id ASC` is the only thing making the walk stable.
      expect(ids).toEqual([...ids].sort());
    });

    it("returns the same page on a repeated identical query", async () => {
      const filter = { search: "tiebreak", userId: owner };

      const once = await repository.findPage(2, 2, filter);
      const twice = await repository.findPage(2, 2, filter);

      assertSuccess(once);
      assertSuccess(twice);
      expect(twice.value.items.map((w) => w.id)).toEqual(once.value.items.map((w) => w.id));
    });
  });

  describe("explicit sorting", () => {
    it("uses the requested fields before pagination", async () => {
      for (const name of ["Charlie", "Alpha", "Bravo"]) {
        await testApp.createWorkbook({ name, createdBy: owner, visibility: "public" });
      }

      const result = await repository.findPage(1, 2, {
        userId: owner,
        sort: [
          { field: "name", direction: "desc" },
          { field: "updated", direction: "asc" },
        ],
      });

      assertSuccess(result);
      expect(result.value.items.map((workbook) => workbook.name)).toEqual(["Charlie", "Bravo"]);
    });

    it("uses an explicit sort even when searching", async () => {
      await testApp.createWorkbook({
        name: "Alpha Project",
        description: "shared search term",
        createdBy: owner,
        visibility: "public",
      });
      await testApp.createWorkbook({
        name: "Zeta Project",
        description: "shared search term",
        createdBy: owner,
        visibility: "public",
      });

      const result = await repository.findPage(1, 20, {
        search: "shared",
        userId: owner,
        sort: [{ field: "name", direction: "desc" }],
      });

      assertSuccess(result);
      expect(result.value.items.map((workbook) => workbook.name)).toEqual([
        "Zeta Project",
        "Alpha Project",
      ]);
    });

    it("sorts every field in both directions, including computed counts and null authors", async () => {
      const amy = await testApp.createTestUser({ name: "Amy Author" });
      const zoe = await testApp.createTestUser({ name: "Zoe Author" });
      const anonymous = await testApp.createTestUser({ name: "Hidden Author" });
      const alpha = await testApp.createWorkbook({
        name: "Alpha Workbook",
        createdBy: amy,
        visibility: "public",
      });
      const bravo = await testApp.createWorkbook({
        name: "Bravo Workbook",
        createdBy: zoe,
        visibility: "public",
      });
      const charlie = await testApp.createWorkbook({
        name: "Charlie Workbook",
        createdBy: anonymous,
        visibility: "public",
      });

      await testApp.database
        .update(profiles)
        .set({ firstName: "", lastName: "" })
        .where(eq(profiles.userId, anonymous));
      await testApp.database
        .update(workbooks)
        .set({ updatedAt: new Date("2025-01-03T00:00:00Z") })
        .where(eq(workbooks.id, alpha.id));
      await testApp.database
        .update(workbooks)
        .set({ updatedAt: new Date("2025-01-01T00:00:00Z") })
        .where(eq(workbooks.id, bravo.id));
      await testApp.database
        .update(workbooks)
        .set({ updatedAt: new Date("2025-01-02T00:00:00Z") })
        .where(eq(workbooks.id, charlie.id));

      for (let index = 0; index < 1; index += 1) {
        const { experiment } = await testApp.createExperiment({
          name: `Workbook sort one ${crypto.randomUUID()}`,
          userId: owner,
          visibility: "public",
        });
        await testApp.database
          .update(experiments)
          .set({ workbookId: bravo.id })
          .where(eq(experiments.id, experiment.id));
      }
      for (let index = 0; index < 2; index += 1) {
        const { experiment } = await testApp.createExperiment({
          name: `Workbook sort two ${crypto.randomUUID()}`,
          userId: owner,
          visibility: "public",
        });
        await testApp.database
          .update(experiments)
          .set({ workbookId: charlie.id })
          .where(eq(experiments.id, experiment.id));
      }

      const expected = {
        name: [alpha.id, bravo.id, charlie.id],
        usedBy: [alpha.id, bravo.id, charlie.id],
        user: [alpha.id, bravo.id, charlie.id],
        updated: [bravo.id, charlie.id, alpha.id],
      } as const;

      for (const field of ["name", "usedBy", "user", "updated"] as const) {
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
          ascending.value.map((workbook) => workbook.id),
          `${field} ascending`,
        ).toEqual(expected[field]);
        expect(
          descending.value.map((workbook) => workbook.id),
          `${field} descending`,
        ).toEqual(
          field === "user" ? [bravo.id, alpha.id, charlie.id] : [...expected[field]].reverse(),
        );
      }
    });

    it("breaks explicit-sort ties by the default order across pages", async () => {
      const created = await Promise.all(
        ["Tie one", "Tie two", "Tie three"].map((name) =>
          testApp.createWorkbook({ name, createdBy: owner, visibility: "public" }),
        ),
      );
      const expected = await nameAgainstIdOrder(created.map((workbook) => workbook.id));
      const [first, second] = await Promise.all([
        repository.findPage(1, 2, {
          userId: owner,
          sort: [{ field: "usedBy", direction: "asc" }],
        }),
        repository.findPage(2, 2, {
          userId: owner,
          sort: [{ field: "usedBy", direction: "asc" }],
        }),
      ]);

      assertSuccess(first);
      assertSuccess(second);
      const ids = [...first.value.items, ...second.value.items].map((workbook) => workbook.id);
      expect(ids).toEqual(expected);
      expect(new Set(ids).size).toBe(created.length);
    });
  });

  describe("visibility filter", () => {
    let mine: { id: string };
    let minePrivate: { id: string };
    let theirs: { id: string };

    beforeEach(async () => {
      mine = await testApp.createWorkbook({
        name: "Soil public",
        createdBy: owner,
        visibility: "public",
      });
      minePrivate = await testApp.createWorkbook({
        name: "Soil private",
        createdBy: owner,
        visibility: "private",
      });
      theirs = await testApp.createWorkbook({
        name: "Leaf public",
        createdBy: stranger,
        visibility: "public",
      });
    });

    it("keeps only rows with the one visibility asked for", async () => {
      const result = await repository.findAll({ userId: owner, visibilities: ["private"] });

      assertSuccess(result);
      expect(result.value.map((w) => w.id)).toEqual([minePrivate.id]);
    });

    it("matches either value when both are asked for", async () => {
      const result = await repository.findAll({
        userId: owner,
        visibilities: ["private", "public"],
      });

      assertSuccess(result);
      expect(result.value.map((w) => w.id).sort()).toEqual(
        [mine.id, minePrivate.id, theirs.id].sort(),
      );
    });

    it("treats an empty list as no filter", async () => {
      const result = await repository.findAll({ userId: owner, visibilities: [] });

      assertSuccess(result);
      expect(result.value).toHaveLength(3);
    });

    it("combines with scope=related and search, and counts the filtered set", async () => {
      const result = await repository.findPage(1, 20, {
        userId: owner,
        scope: "related",
        search: "Soil",
        visibilities: ["public"],
      });

      assertSuccess(result);
      expect(result.value.items.map((w) => w.id)).toEqual([mine.id]);
      expect(result.value.totalCount).toBe(1);
    });
  });

  describe("activity sort", () => {
    it("puts a workbook with no activity total last in both directions", async () => {
      const active = await testApp.createWorkbook({
        name: "Active workbook",
        createdBy: owner,
        visibility: "public",
      });
      const none = await testApp.createWorkbook({
        name: "No activity workbook",
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
      expect(ascending.value.map((w) => w.id)).toEqual([active.id, none.id]);
      expect(descending.value.map((w) => w.id)).toEqual([active.id, none.id]);
    });

    it("orders by activity whether it is the first or the second sort key", async () => {
      const zulu = await testApp.createWorkbook({
        name: "Zulu",
        createdBy: owner,
        visibility: "public",
      });
      const alpha = await testApp.createWorkbook({
        name: "Alpha",
        createdBy: owner,
        visibility: "public",
      });
      const mike = await testApp.createWorkbook({
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
      expect(activityThenName.value.map((w) => w.id)).toEqual([alpha.id, zulu.id, mike.id]);
      expect(nameThenActivity.value.map((w) => w.id)).toEqual([alpha.id, mike.id, zulu.id]);
    });

    it("never repeats or drops a row across pages when many totals tie", async () => {
      const created = await Promise.all(
        ["Tie one", "Tie two", "Tie three", "Tie four"].map((name) =>
          testApp.createWorkbook({ name, createdBy: owner, visibility: "public" }),
        ),
      );
      const expected = await nameAgainstIdOrder(created.map((w) => w.id));
      const totals = new Map(created.map((w) => [w.id, 5]));
      const sort = [{ field: "activity", direction: "desc" }] as const;

      const [first, second] = await Promise.all([
        repository.findPage(1, 2, { userId: owner, sort: [...sort] }, totals),
        repository.findPage(2, 2, { userId: owner, sort: [...sort] }, totals),
      ]);

      assertSuccess(first);
      assertSuccess(second);
      const ids = [...first.value.items, ...second.value.items].map((w) => w.id);
      expect(ids).toEqual(expected);
      expect(new Set(ids).size).toBe(created.length);
      expect(first.value.totalCount).toBe(created.length);
    });

    it("does not change the page count when sorting by activity", async () => {
      const created = await Promise.all(
        ["Count one", "Count two", "Count three"].map((name) =>
          testApp.createWorkbook({ name, createdBy: owner, visibility: "public" }),
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
      const alpha = await testApp.createWorkbook({
        name: "Alpha",
        createdBy: owner,
        visibility: "public",
      });
      const bravo = await testApp.createWorkbook({
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
      expect(result.value.map((w) => w.id)).toEqual([alpha.id, bravo.id]);
    });

    it("accepts an empty totals map, treating every row as having no activity", async () => {
      const created = await Promise.all(
        ["Empty one", "Empty two", "Empty three"].map((name) =>
          testApp.createWorkbook({ name, createdBy: owner, visibility: "public" }),
        ),
      );
      const expected = await nameAgainstIdOrder(created.map((w) => w.id));
      const empty = new Map<string, number>();

      const result = await repository.findAll(
        { userId: owner, sort: [{ field: "activity", direction: "desc" }] },
        undefined,
        empty,
      );

      assertSuccess(result);
      expect(result.value.map((w) => w.id)).toEqual(expected);
    });
  });
});
