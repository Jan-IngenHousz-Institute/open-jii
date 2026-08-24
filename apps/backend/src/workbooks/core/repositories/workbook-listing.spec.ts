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
});
