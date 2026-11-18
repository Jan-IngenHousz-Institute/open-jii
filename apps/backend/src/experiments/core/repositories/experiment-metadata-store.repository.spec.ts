import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { MetadataSheetRecord } from "../models/experiment-metadata.model";
import { SERVING_STORE_PORT } from "../ports/serving-store.port";
import type { ServingStorePort } from "../ports/serving-store.port";
import { ExperimentMetadataStoreRepository } from "./experiment-metadata-store.repository";

describe("ExperimentMetadataStoreRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentMetadataStoreRepository;
  let servingStore: ServingStorePort;

  const created = new Date("2026-09-01T08:00:00.000Z");
  const claimed = new Date("2026-09-02T10:00:00.000Z");

  function sheet(metadata: Record<string, unknown>, id = "s1"): MetadataSheetRecord {
    return {
      id,
      experimentId: "e1",
      metadata,
      createdBy: "u1",
      createdAt: created,
      updatedAt: created,
    };
  }

  const plots = {
    identifierColumnId: "plot",
    experimentQuestionId: "q_plot",
    rows: [
      { _id: "r1", plot: "A1", soil: "clay", area: 1.5 },
      { _id: "r2", plot: "A1", soil: "sand" },
      { _id: "r3", plot: 7, soil: "loam" },
      { _id: "r4", soil: "peat" },
    ],
  };

  function storeHolding(held: { sheet_id: string; identifier: string }[] = []) {
    const insert = vi.spyOn(servingStore, "insertRows").mockResolvedValue(success(undefined));
    const select = vi.spyOn(servingStore, "selectRows").mockResolvedValue(success(held));
    return { insert, select };
  }

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ExperimentMetadataStoreRepository);
    servingStore = testApp.module.get(SERVING_STORE_PORT);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("merge", () => {
    it("writes each identifier's first row, its fields without the row id or the identifier", async () => {
      const { insert } = storeHolding();

      assertSuccess(await repository.merge([sheet(plots)], () => true, claimed));

      expect(insert).toHaveBeenCalledWith("metadata_rows", [
        {
          experiment_id: "e1",
          sheet_id: "s1",
          sheet_created_at: "2026-09-01T08:00:00.000Z",
          match_on: "q_plot",
          identifier: "A1",
          fields: '{"soil":"clay","area":1.5}',
          is_deleted: 0,
          claimed_at: "2026-09-02T10:00:00.000Z",
        },
        expect.objectContaining({ identifier: "7", fields: '{"soil":"loam"}' }),
      ]);
    });

    it("removes the rows an edit took out of a sheet", async () => {
      const { insert } = storeHolding([
        { sheet_id: "s1", identifier: "A1" },
        { sheet_id: "s1", identifier: "B2" },
      ]);

      assertSuccess(await repository.merge([sheet(plots)], () => true, claimed));

      const [, written] = insert.mock.calls[0];
      expect(written).toContainEqual(
        expect.objectContaining({ identifier: "B2", is_deleted: 1, sheet_id: "s1" }),
      );
      expect(written).not.toContainEqual(
        expect.objectContaining({ identifier: "A1", is_deleted: 1 }),
      );
    });

    it("removes the rows a large sheet lost without stalling on how many it held", async () => {
      const held = Array.from({ length: 100_000 }, (_, index) => ({
        sheet_id: "s1",
        identifier: `plot-${index}`,
      }));
      const { insert } = storeHolding(held);
      const kept = { ...plots, rows: [{ _id: "r1", plot: "plot-0", soil: "clay" }] };

      assertSuccess(await repository.merge([sheet(kept)], () => true, claimed));

      const [, written] = insert.mock.calls[0];
      expect(written).toHaveLength(100_000);
      expect(written.filter((row) => "is_deleted" in row && row.is_deleted === 1)).toHaveLength(
        99_999,
      );
    });

    it("copies no rows of a sheet saved before its shape was checked", async () => {
      const { insert } = storeHolding();

      assertSuccess(await repository.merge([sheet({ name: "Plots" })], () => true, claimed));

      expect(insert).toHaveBeenCalledWith("metadata_rows", []);
    });

    it("starts no insert once the claim's deadline passed while the held rows were read", async () => {
      const { insert, select } = storeHolding([{ sheet_id: "s1", identifier: "B2" }]);

      const result = await repository.merge([sheet(plots)], () => false, claimed);

      assertSuccess(result);
      expect(result.value).toBe("stopped");
      expect(select).toHaveBeenCalledTimes(1);
      expect(insert).not.toHaveBeenCalled();
    });

    it("writes nothing of a sheet when the store's held rows cannot be read", async () => {
      const { insert, select } = storeHolding();
      select.mockResolvedValue(
        failure(AppError.internal("The serving store could not take the copy")),
      );

      const result = await repository.merge([sheet(plots)], () => true, claimed);

      assertFailure(result);
      expect(insert).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("removes every row the store holds of a deleted sheet", async () => {
      const { insert, select } = storeHolding([
        { sheet_id: "s1", identifier: "A1" },
        { sheet_id: "s1", identifier: "7" },
      ]);

      assertSuccess(await repository.delete([{ id: "s1", experimentId: "e1" }], claimed));

      expect(select).toHaveBeenCalledWith(
        expect.stringContaining("FROM metadata_rows FINAL"),
        { experiments: ["e1"], sheets: ["s1"] },
        expect.anything(),
      );
      expect(insert.mock.calls[0][1]).toEqual([
        expect.objectContaining({ identifier: "A1", is_deleted: 1 }),
        expect.objectContaining({ identifier: "7", is_deleted: 1 }),
      ]);
    });
  });

  describe("statementGroups", () => {
    it("starts a new insert once a group's sheets would pass 16 MiB", () => {
      const big = 10 * 1024 * 1024;

      const groups = repository.statementGroups([
        { id: "s1", bytes: big },
        { id: "s2", bytes: big },
        { id: "s3", bytes: 1 },
      ]);

      expect(groups).toEqual([["s1"], ["s2", "s3"]]);
    });
  });
});
