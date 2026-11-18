import { assertSuccess, success } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { SERVING_STORE_PORT } from "../ports/serving-store.port";
import type { ServingStorePort } from "../ports/serving-store.port";
import { ExperimentAnnotationsStoreRepository } from "./experiment-annotations-store.repository";

describe("ExperimentAnnotationsStoreRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentAnnotationsStoreRepository;
  let servingStore: ServingStorePort;

  const created = new Date("2026-09-01T08:00:00.000Z");
  const claimed = new Date("2026-09-02T10:00:00.000Z");

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ExperimentAnnotationsStoreRepository);
    servingStore = testApp.module.get(SERVING_STORE_PORT);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("writes an annotation as its row and a deleted one as a row the views leave out", async () => {
    const insert = vi.spyOn(servingStore, "insertRows").mockResolvedValue(success(undefined));

    assertSuccess(
      await repository.merge(
        [
          {
            id: "a1",
            experimentId: "e1",
            tableName: "raw_data",
            rowId: "11",
            type: "flag",
            contentText: "Outlier",
            flagType: "outlier",
            createdBy: "u1",
            createdAt: created,
            updatedAt: created,
            userName: "Ada Lovelace",
          },
        ],
        claimed,
      ),
    );
    assertSuccess(await repository.delete([{ id: "a2", experimentId: "e1" }], claimed));

    expect(insert.mock.calls).toEqual([
      [
        "annotations",
        [
          {
            experiment_id: "e1",
            id: "a1",
            table_name: "raw_data",
            row_id: "11",
            type: "flag",
            flag_type: "outlier",
            is_deleted: 0,
            claimed_at: "2026-09-02T10:00:00.000Z",
          },
        ],
      ],
      ["annotations", [expect.objectContaining({ id: "a2", experiment_id: "e1", is_deleted: 1 })]],
    ]);
  });
});
