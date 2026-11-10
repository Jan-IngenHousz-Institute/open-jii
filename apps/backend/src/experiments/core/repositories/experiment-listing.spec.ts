import { eq, experiments } from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { ExperimentRepository } from "./experiment.repository";

describe("ExperimentRepository activity sort", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentRepository;
  let owner: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ExperimentRepository);
    owner = await testApp.createTestUser({});
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  // Recency runs against id order, so a result in recency order cannot come from the id tiebreak.
  async function updateAgainstIdOrder(ids: string[]) {
    const expected = [...ids].sort().reverse();
    for (const [index, id] of expected.entries()) {
      await testApp.database
        .update(experiments)
        .set({ updatedAt: new Date(Date.UTC(2025, 0, expected.length - index)) })
        .where(eq(experiments.id, id));
    }
    return expected;
  }

  it("puts a resource with no activity total last in both directions", async () => {
    const { experiment: active } = await testApp.createExperiment({
      name: "Active experiment",
      userId: owner,
    });
    const { experiment: none } = await testApp.createExperiment({
      name: "No activity experiment",
      userId: owner,
    });
    const totals = new Map([[active.id, 7]]);

    const ascending = await repository.findAll(
      owner,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      [{ field: "activity", direction: "asc" }],
      totals,
    );
    const descending = await repository.findAll(
      owner,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      [{ field: "activity", direction: "desc" }],
      totals,
    );

    assertSuccess(ascending);
    assertSuccess(descending);
    expect(ascending.value.map((item) => item.id)).toEqual([active.id, none.id]);
    expect(descending.value.map((item) => item.id)).toEqual([active.id, none.id]);
  });

  it("orders by activity whether it is the first or the second sort key", async () => {
    const { experiment: zulu } = await testApp.createExperiment({ name: "Zulu", userId: owner });
    const { experiment: alpha } = await testApp.createExperiment({ name: "Alpha", userId: owner });
    const { experiment: mike } = await testApp.createExperiment({ name: "Mike", userId: owner });
    // zulu and alpha tie on activity; mike trails both.
    const totals = new Map([
      [zulu.id, 10],
      [alpha.id, 10],
      [mike.id, 1],
    ]);

    const activityThenName = await repository.findAll(
      owner,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      [
        { field: "activity", direction: "desc" },
        { field: "name", direction: "asc" },
      ],
      totals,
    );
    const nameThenActivity = await repository.findAll(
      owner,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      [
        { field: "name", direction: "asc" },
        { field: "activity", direction: "desc" },
      ],
      totals,
    );

    assertSuccess(activityThenName);
    assertSuccess(nameThenActivity);
    // Activity first: the tied pair (desc) before mike, broken by name asc within the tie.
    expect(activityThenName.value.map((item) => item.id)).toEqual([alpha.id, zulu.id, mike.id]);
    // Name first: alphabetical regardless of activity.
    expect(nameThenActivity.value.map((item) => item.id)).toEqual([alpha.id, mike.id, zulu.id]);
  });

  it("never repeats or drops a row across pages when many totals tie", async () => {
    const created = await Promise.all(
      ["Tie one", "Tie two", "Tie three", "Tie four"].map((name) =>
        testApp.createExperiment({ name, userId: owner }).then((r) => r.experiment),
      ),
    );
    const expected = await updateAgainstIdOrder(created.map((experiment) => experiment.id));
    const totals = new Map(created.map((experiment) => [experiment.id, 5]));
    const sort = [{ field: "activity", direction: "desc" }] as const;

    const [first, second] = await Promise.all([
      repository.findPage(
        owner,
        1,
        2,
        undefined,
        undefined,
        undefined,
        undefined,
        [...sort],
        totals,
      ),
      repository.findPage(
        owner,
        2,
        2,
        undefined,
        undefined,
        undefined,
        undefined,
        [...sort],
        totals,
      ),
    ]);

    assertSuccess(first);
    assertSuccess(second);
    const ids = [...first.value.items, ...second.value.items].map((item) => item.id);
    expect(ids).toEqual(expected);
    expect(new Set(ids).size).toBe(created.length);
    expect(first.value.totalCount).toBe(created.length);
  });

  it("does not change the page count when sorting by activity", async () => {
    const created = await Promise.all(
      ["Count one", "Count two", "Count three"].map((name) =>
        testApp.createExperiment({ name, userId: owner }).then((r) => r.experiment),
      ),
    );
    const totals = new Map([[created[0].id, 3]]);

    const withActivity = await repository.findPage(
      owner,
      1,
      1,
      undefined,
      undefined,
      undefined,
      undefined,
      [{ field: "activity", direction: "desc" }],
      totals,
    );
    const withoutActivity = await repository.findPage(owner, 1, 1);

    assertSuccess(withActivity);
    assertSuccess(withoutActivity);
    expect(withActivity.value.totalCount).toBe(created.length);
    expect(withActivity.value.totalCount).toBe(withoutActivity.value.totalCount);
  });

  it("ignores activity totals entirely when the sort does not include activity", async () => {
    const { experiment: alpha } = await testApp.createExperiment({ name: "Alpha", userId: owner });
    const { experiment: bravo } = await testApp.createExperiment({ name: "Bravo", userId: owner });
    // Out of int4 range: if this were joined anyway, the query would fail to
    // bind it rather than silently ignore it, so success here is itself proof
    // that a non-activity sort never triggers the join.
    const totals = new Map([[bravo.id, Number.MAX_SAFE_INTEGER]]);

    const result = await repository.findAll(
      owner,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      [{ field: "name", direction: "asc" }],
      totals,
    );

    assertSuccess(result);
    expect(result.value.map((item) => item.id)).toEqual([alpha.id, bravo.id]);
  });

  it("accepts an empty totals map, treating every row as having no activity", async () => {
    const created = await Promise.all(
      ["Empty one", "Empty two", "Empty three"].map((name) =>
        testApp.createExperiment({ name, userId: owner }).then((r) => r.experiment),
      ),
    );
    const expected = await updateAgainstIdOrder(created.map((experiment) => experiment.id));
    const empty = new Map<string, number>();

    const result = await repository.findAll(
      owner,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      [{ field: "activity", direction: "desc" }],
      empty,
    );

    assertSuccess(result);
    expect(result.value.map((item) => item.id)).toEqual(expected);
  });
});
