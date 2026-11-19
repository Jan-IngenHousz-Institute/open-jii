import { ConfigService } from "@nestjs/config";

import { ServingStoreClientService } from "../../../common/modules/serving-store/services/client/client.service";
import { ServingStoreConfigService } from "../../../common/modules/serving-store/services/config/config.service";
import { ServingStoreAdapter } from "../../../common/modules/serving-store/serving-store.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../common/utils/fp-utils";
import type { ExperimentTableMetadata } from "../../core/models/experiment-data.model";
import type { StoreMetadataSheet } from "../../core/ports/serving-store.port";
import { CustomMetadataService } from "./custom-metadata.service";

describe("CustomMetadataService", () => {
  let store: ServingStoreAdapter;
  let service: CustomMetadataService;

  const table = (
    tableType: ExperimentTableMetadata["tableType"],
    identifier: string,
  ): ExperimentTableMetadata => ({
    identifier,
    tableType,
    displayName: null,
    rowCount: 1,
    latestRowAt: null,
    schemaRevision: "r1",
    customMetadataSchema: null,
  });
  const tables = [table("static", "raw_data"), table("macro", "m1"), table("upload", "t1")];

  const sheet = (id: string, schema: string | null, version = "1"): StoreMetadataSheet => ({
    id,
    matchOn: "plot",
    schema,
    version,
  });

  beforeEach(() => {
    const client = new ServingStoreClientService(
      new ServingStoreConfigService(new ConfigService({})),
    );
    store = new ServingStoreAdapter(client);
    service = new CustomMetadataService(store);
  });

  it("lists the tables the sheets match with their schemas joined, decimals kept, and no upload", async () => {
    vi.spyOn(store, "getMetadataSheets").mockResolvedValue(
      success([
        sheet("s1", "OBJECT<area: DECIMAL(3,2), soil: STRING>"),
        sheet("s2", "OBJECT<area: BIGINT, note: VOID>"),
        sheet("s3", null),
      ]),
    );

    const result = await service.typed("e1", tables);

    assertSuccess(result);
    const [rawData, macro, upload] = result.value;
    const joined = "OBJECT<area: DECIMAL(22,2), note: VOID, soil: STRING>";
    expect([rawData.customMetadataSchema, macro.customMetadataSchema]).toEqual([joined, joined]);
    expect(rawData.schemaRevision).toMatch(/^r1:[0-9a-f]{32}$/);
    expect(upload).toEqual(tables[2]);
  });

  it("moves the revision with every change to a sheet the store takes, its schema the same or not", async () => {
    const sheets = vi.spyOn(store, "getMetadataSheets");
    const revision = async (listed: StoreMetadataSheet[]) => {
      sheets.mockResolvedValueOnce(success(listed));
      const result = await service.typed("e1", tables);
      assertSuccess(result);
      return result.value[0].schemaRevision;
    };

    const first = await revision([sheet("s1", "OBJECT<soil: STRING>", "4")]);
    const again = await revision([sheet("s1", "OBJECT<soil: STRING>", "4")]);
    const edited = await revision([sheet("s1", "OBJECT<soil: STRING>", "5")]);
    const deleted = await revision([]);

    expect(again).toBe(first);
    expect(edited).not.toBe(first);
    expect(deleted).toBe("r1");
  });

  it("reads no sheets for a listing of uploads alone", async () => {
    const sheets = vi.spyOn(store, "getMetadataSheets");

    const result = await service.typed("e1", [tables[2]]);

    assertSuccess(result);
    expect(result.value).toEqual([tables[2]]);
    expect(sheets).not.toHaveBeenCalled();
  });

  it("passes on a sheet read that failed", async () => {
    vi.spyOn(store, "getMetadataSheets").mockResolvedValue(
      failure(AppError.internal("The serving store could not answer the read")),
    );

    const result = await service.typed("e1", tables);

    assertFailure(result);
  });
});
