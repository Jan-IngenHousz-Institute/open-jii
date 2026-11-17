import { ConfigService } from "@nestjs/config";

import type { MetadataSheetRecord } from "../../../experiments/core/models/experiment-metadata.model";
import { assertFailure, assertSuccess, AppError, failure, success } from "../../utils/fp-utils";
import { ServingStoreCopierClientService } from "./services/client/copier-client.service";
import { ServingStoreConfigService } from "./services/config/config.service";
import { ServingStoreCopiesAdapter } from "./serving-store-copies.adapter";

describe("ServingStoreCopiesAdapter", () => {
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

  function adapterHolding(held: { sheet_id: string; identifier: string }[] = []) {
    const client = new ServingStoreCopierClientService(
      new ServingStoreConfigService(new ConfigService({ servingStore: {} })),
    );
    const insert = vi.spyOn(client, "insert").mockResolvedValue(success(undefined));
    const rows = vi.spyOn(client, "rows").mockResolvedValue(success(held));
    return { adapter: new ServingStoreCopiesAdapter(client), insert, rows };
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

  it("writes each identifier's first row, its fields without the row id or the identifier", async () => {
    const { adapter, insert } = adapterHolding();

    assertSuccess(await adapter.writeSheets([sheet(plots)], claimed, () => true));

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
    const { adapter, insert } = adapterHolding([
      { sheet_id: "s1", identifier: "A1" },
      { sheet_id: "s1", identifier: "B2" },
    ]);

    assertSuccess(await adapter.writeSheets([sheet(plots)], claimed, () => true));

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
    const { adapter, insert } = adapterHolding(held);
    const kept = {
      ...plots,
      rows: [{ _id: "r1", plot: "plot-0", soil: "clay" }],
    };

    assertSuccess(await adapter.writeSheets([sheet(kept)], claimed, () => true));

    const [, written] = insert.mock.calls[0];
    expect(written).toHaveLength(100_000);
    expect(written.filter((row) => "is_deleted" in row && row.is_deleted === 1)).toHaveLength(
      99_999,
    );
  });

  it("copies no rows of a sheet saved before its shape was checked", async () => {
    const { adapter, insert } = adapterHolding();

    assertSuccess(await adapter.writeSheets([sheet({ name: "Plots" })], claimed, () => true));

    expect(insert).toHaveBeenCalledWith("metadata_rows", []);
  });

  it("removes every row the store holds of a deleted sheet", async () => {
    const { adapter, insert, rows } = adapterHolding([
      { sheet_id: "s1", identifier: "A1" },
      { sheet_id: "s1", identifier: "7" },
    ]);

    assertSuccess(await adapter.removeSheets([{ id: "s1", experimentId: "e1" }], claimed));

    expect(rows).toHaveBeenCalledWith(
      expect.stringContaining("FROM metadata_rows FINAL"),
      { experiments: ["e1"], sheets: ["s1"] },
      expect.anything(),
    );
    expect(insert.mock.calls[0][1]).toEqual([
      expect.objectContaining({ identifier: "A1", is_deleted: 1 }),
      expect.objectContaining({ identifier: "7", is_deleted: 1 }),
    ]);
  });

  it("writes an annotation as its row and a removed one as a row the views leave out", async () => {
    const { adapter, insert } = adapterHolding();

    assertSuccess(
      await adapter.writeAnnotations(
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
    assertSuccess(await adapter.removeAnnotations([{ id: "a2", experimentId: "e1" }], claimed));

    expect(insert.mock.calls.map(([table, rows]) => [table, rows])).toEqual([
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

  it("starts no insert once the claim's deadline passed while the held rows were read", async () => {
    const { adapter, insert, rows } = adapterHolding([{ sheet_id: "s1", identifier: "B2" }]);

    const result = await adapter.writeSheets([sheet(plots)], claimed, () => false);

    assertSuccess(result);
    expect(result.value).toBe("stopped");
    expect(rows).toHaveBeenCalledTimes(1);
    expect(insert).not.toHaveBeenCalled();
  });

  it("writes nothing of a sheet when the store's held rows cannot be read", async () => {
    const { adapter, insert, rows } = adapterHolding();
    rows.mockResolvedValue(failure(AppError.internal("The serving store could not take the copy")));

    const result = await adapter.writeSheets([sheet(plots)], claimed, () => true);

    assertFailure(result);
    expect(insert).not.toHaveBeenCalled();
  });
});
