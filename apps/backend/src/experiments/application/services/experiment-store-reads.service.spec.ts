import { WellKnownColumnTypes } from "@repo/api/domains/experiment/data/experiment-data.schema";

import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import { AppError, assertSuccess, failure, success } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { PAGE_BYTE_LIMIT } from "../../core/models/experiment-data.model";
import type {
  ExperimentQueryParams,
  ExperimentTableMetadata,
  FlaggedRows,
} from "../../core/models/experiment-data.model";
import type { FlowGraphDto } from "../../core/models/flow.model";
import { SERVING_STORE_PORT } from "../../core/ports/serving-store.port";
import type { ServingStorePort } from "../../core/ports/serving-store.port";
import { ExperimentAnnotationsRepository } from "../../core/repositories/experiment-annotations.repository";
import { FlowRepository } from "../../core/repositories/flow.repository";
import { ExperimentStoreReadsService } from "./experiment-store-reads.service";

describe("ExperimentStoreReadsService", () => {
  const testApp = TestHarness.App;
  let reads: ExperimentStoreReadsService;
  let store: ServingStorePort;

  const page: Pick<ExperimentQueryParams, "tableName" | "tableType" | "experimentId"> = {
    tableName: "raw_data",
    tableType: "static",
    experimentId: "e1",
  };

  const unknownDevice = (label: string | null) => ({
    id: null,
    serial_number: label,
    owner: null,
    status: null,
    device_type: null,
  });

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    reads = testApp.module.get(ExperimentStoreReadsService);
    store = testApp.module.get(SERVING_STORE_PORT);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  function storeRows(columns: SchemaData["columns"], rows: (string | null)[][]) {
    return vi
      .spyOn(store, "executeQuery")
      .mockResolvedValue(success({ columns, rows, totalRows: rows.length, truncated: false }));
  }

  it("fills contributors and devices from Postgres in the warehouse's struct text", async () => {
    const ada = await testApp.createTestUser({ name: "Ada Lovelace" });
    const device = await testApp.createIotDevice({
      createdBy: ada,
      serialNumber: "SN-1",
      thingName: "thing-1",
    });
    storeRows(
      [
        {
          name: "contributor",
          type_name: "STRUCT",
          type_text: WellKnownColumnTypes.CONTRIBUTOR,
          position: 0,
        },
        {
          name: "device",
          type_name: "STRUCT",
          type_text: WellKnownColumnTypes.DEVICE,
          position: 1,
        },
      ],
      [
        [ada, '["thing-1","MultispeQ (d1)"]'],
        [null, "[null,null]"],
      ],
    );

    const query = await reads.buildQuery({ ...page, columns: ["contributor", "device"] });
    assertSuccess(query);
    const result = await reads.runQuery(query.value);

    assertSuccess(result);
    expect(result.value.rows).toEqual([
      [
        JSON.stringify({ id: ada, name: "Ada Lovelace", avatar: null }),
        JSON.stringify({
          id: device.id,
          serial_number: "SN-1",
          owner: ada,
          status: "registered",
          device_type: "generic",
        }),
      ],
      [null, JSON.stringify(unknownDevice(null))],
    ]);
  });

  it("labels a device without a serial number by its row's names, as the warehouse does", async () => {
    const owner = await testApp.createTestUser({});
    const blank = await testApp.createIotDevice({
      createdBy: owner,
      serialNumber: "  ",
      thingName: "thing-blank",
    });
    storeRows(
      [
        {
          name: "device",
          type_name: "STRUCT",
          type_text: WellKnownColumnTypes.DEVICE,
          position: 0,
        },
      ],
      [['["thing-blank","Probe (blank)"]'], ['["phone-1","Probe (phone-1)"]'], ['[null,"Bench"]']],
    );

    const query = await reads.buildQuery({ ...page, columns: ["device"] });
    assertSuccess(query);
    const result = await reads.runQuery(query.value);

    assertSuccess(result);
    expect(result.value.rows).toEqual([
      [
        JSON.stringify({
          id: blank.id,
          serial_number: "Probe (blank)",
          owner,
          status: "registered",
          device_type: "generic",
        }),
      ],
      [JSON.stringify(unknownDevice("Probe (phone-1)"))],
      [JSON.stringify(unknownDevice("Bench"))],
    ]);
  });

  it("names contributors as the pipelines do, one unknown to Postgres with an empty name", async () => {
    const hidden = await testApp.createTestUser({ name: "Grace Hopper", activated: false });
    const noProfile = await testApp.createTestUser({ createProfile: false });
    storeRows(
      [
        {
          name: "contributor",
          type_name: "STRUCT",
          type_text: WellKnownColumnTypes.CONTRIBUTOR,
          position: 0,
        },
      ],
      [[hidden], [noProfile], ["not-a-uuid"]],
    );

    const query = await reads.buildQuery({ ...page, columns: ["contributor"] });
    assertSuccess(query);
    const result = await reads.runQuery(query.value);

    assertSuccess(result);
    expect(result.value.rows).toEqual([
      [JSON.stringify({ id: hidden, name: "Unknown User", avatar: null })],
      [JSON.stringify({ id: noProfile, name: "", avatar: null })],
      [JSON.stringify({ id: "not-a-uuid", name: "", avatar: null })],
    ]);
  });

  it("orders a sort on contributors' names by the ids it hands the store, names left out", async () => {
    const zoe = await testApp.createTestUser({ name: "Zoe Zed" });
    const ada = await testApp.createTestUser({ name: "Ada Lovelace" });
    vi.spyOn(store, "getExperimentIds").mockResolvedValue(success([zoe, ada]));
    const build = vi.spyOn(store, "buildExperimentQuery");

    const query = await reads.buildQuery({ ...page, ordering: { column: "contributor.name" } });

    assertSuccess(query);
    expect(build).toHaveBeenCalledWith(expect.objectContaining({ orderByIds: [[ada], [zoe]] }));
    expect(query.value.sql).not.toContain("Lovelace");
  });

  it("reads the rows flagged in Postgres for a read filtered by flags", async () => {
    const lookup = vi
      .spyOn(testApp.module.get(ExperimentAnnotationsRepository), "findFlaggedRowIds")
      .mockResolvedValue(success(["7", "9"]));

    const flagged = await reads.flaggedRows(page.experimentId, "raw_data", "only");

    assertSuccess(flagged);
    expect(flagged.value).toEqual({ kind: "only", addedRowIds: ["7", "9"] });
    expect(lookup).toHaveBeenCalledExactlyOnceWith(page.experimentId, "raw_data");
  });

  it("hands the store the flagged rows its read looked up, and looks up none itself", async () => {
    const lookup = vi.spyOn(
      testApp.module.get(ExperimentAnnotationsRepository),
      "findFlaggedRowIds",
    );
    const build = vi.spyOn(store, "buildExperimentQuery");
    const flagged: FlaggedRows = { kind: "only", addedRowIds: ["7"] };

    assertSuccess(await reads.buildQuery({ ...page, flagged }));

    expect(build).toHaveBeenCalledWith(expect.objectContaining({ flagged }));
    expect(lookup).not.toHaveBeenCalled();
  });

  it("groups contributors who share a name, so the row id orders their rows", async () => {
    const jan = await testApp.createTestUser({ name: "Jan Jansen" });
    const ada = await testApp.createTestUser({ name: "Ada Lovelace" });
    const namesake = await testApp.createTestUser({ name: "Jan Jansen" });
    vi.spyOn(store, "getExperimentIds").mockResolvedValue(success([jan, ada, namesake]));
    const build = vi.spyOn(store, "buildExperimentQuery");

    await reads.buildQuery({ ...page, ordering: { column: "contributor.name" } });

    expect(build).toHaveBeenCalledWith(
      expect.objectContaining({ orderByIds: [[ada], [jan, namesake].sort()] }),
    );
  });

  it("leaves an anonymized contributor sort to the pseudonym the store computes", async () => {
    const ids = vi.spyOn(store, "getExperimentIds");

    const query = await reads.buildQuery({
      ...page,
      ordering: { column: "contributor.id", mode: { kind: "pseudonym", salt: "e1" } },
    });

    assertSuccess(query);
    expect(ids).not.toHaveBeenCalled();
  });

  it("hands the store only the serial numbers a label shows, for a filter on one, a blank one as none", async () => {
    const owner = await testApp.createTestUser({});
    await testApp.createIotDevice({ createdBy: owner, serialNumber: "SN-7", thingName: "thing-7" });
    await testApp.createIotDevice({ createdBy: owner, serialNumber: "  ", thingName: "thing-8" });
    vi.spyOn(store, "getExperimentIds").mockResolvedValue(success(["thing-7", "thing-8", "phone"]));
    const build = vi.spyOn(store, "buildExperimentQuery");

    const query = await reads.buildQuery({
      ...page,
      filters: [{ column: "device.serial_number", operator: "equals", value: "SN-7" }],
    });

    assertSuccess(query);
    expect(build).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceSerials: [
          ["thing-7", "SN-7"],
          ["thing-8", null],
        ],
      }),
    );
  });

  it("hands the store the serial numbers when a read lists devices' labels", async () => {
    const owner = await testApp.createTestUser({});
    await testApp.createIotDevice({ createdBy: owner, serialNumber: "SN-9", thingName: "thing-9" });
    vi.spyOn(store, "getExperimentIds").mockResolvedValue(success(["thing-9", "phone"]));
    const build = vi.spyOn(store, "buildExperimentQuery");

    await reads.buildQuery({ ...page, columns: ["device.serial_number"] });

    expect(build).toHaveBeenCalledWith(
      expect.objectContaining({ deviceSerials: [["thing-9", "SN-9"]] }),
    );
  });

  it("sorts devices as Spark sorts their structs, registered ones by id and the rest by label", async () => {
    const owner = await testApp.createTestUser({});
    const first = await testApp.createIotDevice({
      createdBy: owner,
      serialNumber: "SN-B",
      thingName: "thing-b",
    });
    const second = await testApp.createIotDevice({
      createdBy: owner,
      serialNumber: "SN-C",
      thingName: "thing-c",
    });
    const ids = vi
      .spyOn(store, "getExperimentIds")
      .mockResolvedValue(success(["thing-c", "phone-a", "thing-b"]));
    const build = vi.spyOn(store, "buildExperimentQuery");

    await reads.buildQuery({ ...page, ordering: { column: "device" } });

    const byId = [
      { thing: "thing-b", id: first.id },
      { thing: "thing-c", id: second.id },
    ].sort((a, b) => (a.id < b.id ? -1 : 1));
    const [params] = build.mock.calls[0];
    expect(params.orderByIds).toEqual(byId.map(({ thing }) => [thing]));
    // The label that breaks the rest needs the serial numbers, from the same one lookup.
    expect(params.deviceSerials).toEqual([
      ["thing-c", "SN-C"],
      ["thing-b", "SN-B"],
    ]);
    expect(ids).toHaveBeenCalledTimes(1);
  });

  it("folds devices that fill in alike before it limits a distinct read", async () => {
    const owner = await testApp.createTestUser({});
    await testApp.createIotDevice({ createdBy: owner, serialNumber: "SN-1", thingName: "thing-1" });
    vi.spyOn(store, "getExperimentIds").mockResolvedValue(
      success(["phone-a", "phone-b", "thing-1"]),
    );
    const build = vi.spyOn(store, "buildExperimentQuery");
    storeRows(
      [
        {
          name: "device",
          type_name: "STRUCT",
          type_text: WellKnownColumnTypes.DEVICE,
          position: 0,
        },
      ],
      [
        ['["phone-a","Phone"]'],
        ['["phone-b","Phone"]'],
        ['["thing-1","MultispeQ (d1)"]'],
        ['["thing-1","MultispeQ (d2)"]'],
      ],
    );

    const query = await reads.buildQuery({
      ...page,
      columns: ["device"],
      distinct: true,
      ordering: { column: "device" },
      limit: 2,
    });
    assertSuccess(query);
    const result = await reads.runQuery(query.value);

    assertSuccess(result);
    expect(build).toHaveBeenCalledWith(expect.objectContaining({ limit: undefined }));
    const [unknown, known] = result.value.rows.map(([cell]) => cell ?? "");
    expect(unknown).toBe(JSON.stringify(unknownDevice("Phone")));
    expect(known).toContain('"serial_number":"SN-1"');
    expect(result.value.totalRows).toBe(2);
  });

  it("keeps a distinct read's limit in the store when no device can repeat", async () => {
    const build = vi.spyOn(store, "buildExperimentQuery");

    await reads.buildQuery({ ...page, columns: ["contributor"], distinct: true, limit: 2 });

    expect(build).toHaveBeenCalledWith(expect.objectContaining({ limit: 2 }));
  });

  it("marks a read truncated once its cells, as the warehouse writes them, pass the read limit", async () => {
    const name = { name: "device_name", type_name: "STRING", type_text: "STRING", position: 0 };
    const query = await reads.buildQuery({ ...page, columns: ["device_name"] });
    assertSuccess(query);
    const truncatedWith = async (cell: string) => {
      storeRows([name], [[cell]]);
      const result = await reads.runQuery(query.value);
      assertSuccess(result);
      return result.value.truncated;
    };

    // The read's JSON is the cell between `[["` and `"]]`.
    const atLimit = "x".repeat(PAGE_BYTE_LIMIT - 6);
    expect(await truncatedWith(atLimit)).toBe(false);
    expect(await truncatedWith(`${atLimit}x`)).toBe(true);
  });

  it("returns only the distinct values that fit the read limit, as the warehouse cuts a read", async () => {
    const name = { name: "device_name", type_name: "STRING", type_text: "STRING", position: 0 };
    const half = "x".repeat(PAGE_BYTE_LIMIT / 2);
    storeRows([name], [["a"], ["b"], [half], [`${half}y`]]);
    const query = await reads.buildQuery({ ...page, columns: ["device_name"], distinct: true });
    assertSuccess(query);

    const result = await reads.runQuery(query.value);

    assertSuccess(result);
    expect(result.value.rows).toEqual([["a"], ["b"], [half]]);
    expect(result.value.totalRows).toBe(3);
    expect(result.value.truncated).toBe(true);
  });

  it("keeps a chart's rows that fit once filled in and marks the rest cut, as the warehouse cuts it", async () => {
    const name = { name: "device_name", type_name: "STRING", type_text: "STRING", position: 0 };
    const query = await reads.buildQuery({ ...page, columns: ["device_name"], isChartRead: true });
    assertSuccess(query);
    storeRows([name], [["a"], ["x".repeat(PAGE_BYTE_LIMIT)], ["c"]]);

    const result = await reads.runQuery(query.value);

    assertSuccess(result);
    expect(result.value.rows).toEqual([["a"]]);
    expect(result.value).toMatchObject({ totalRows: 1, truncated: true });
  });

  it("gives an aggregation over devices every registered device, a blank serial as none", async () => {
    const owner = await testApp.createTestUser({});
    await testApp.createIotDevice({ createdBy: owner, serialNumber: "SN-1", thingName: "thing-1" });
    await testApp.createIotDevice({ createdBy: owner, serialNumber: " ", thingName: "thing-2" });
    vi.spyOn(store, "getExperimentIds").mockResolvedValue(
      success(["thing-1", "thing-2", "phone-a"]),
    );
    const build = vi.spyOn(store, "buildExperimentQuery");

    await reads.buildQuery({
      ...page,
      aggregation: {
        groupBy: [{ column: "device" }],
        functions: [{ column: "*", function: "count" }],
      },
    });

    expect(build.mock.calls[0][0].deviceSerials).toEqual([
      ["thing-1", "SN-1"],
      ["thing-2", null],
    ]);
  });

  it("hands a running sum grouped first by device the registry's order", async () => {
    const owner = await testApp.createTestUser({});
    const first = await testApp.createIotDevice({ createdBy: owner, thingName: "thing-c" });
    const second = await testApp.createIotDevice({ createdBy: owner, thingName: "thing-b" });
    vi.spyOn(store, "getExperimentIds").mockResolvedValue(success(["thing-c", "thing-b"]));
    const build = vi.spyOn(store, "buildExperimentQuery");

    await reads.buildQuery({
      ...page,
      aggregation: {
        groupBy: [{ column: "device" }],
        functions: [{ column: "*", function: "cumsum" }],
      },
    });

    const byId = [
      { thing: "thing-c", id: first.id },
      { thing: "thing-b", id: second.id },
    ].sort((a, b) => (a.id < b.id ? -1 : 1));
    expect(build.mock.calls[0][0].orderByIds).toEqual(byId.map(({ thing }) => [thing]));
  });

  it("looks the devices up only for an aggregation that names one or keeps every row", async () => {
    const ids = vi.spyOn(store, "getExperimentIds").mockResolvedValue(success([]));
    const read = (aggregation: ExperimentQueryParams["aggregation"]) =>
      reads.buildQuery({ ...page, aggregation });

    await read({
      groupBy: [{ column: "timestamp", timeBucket: "day" }],
      functions: [{ column: "latitude", function: "avg" }],
    });
    expect(ids).not.toHaveBeenCalled();

    await read({
      groupBy: [{ column: "device" }],
      functions: [{ column: "*", function: "count" }],
    });
    await read({
      functions: [{ column: "*", function: "row_number", orderColumn: "timestamp" }],
    });
    expect(ids).toHaveBeenCalledTimes(2);
  });

  it("fills a matched table's device, and leaves it null where no row matched", async () => {
    const owner = await testApp.createTestUser({});
    await testApp.createIotDevice({ createdBy: owner, serialNumber: "SN-1", thingName: "thing-1" });
    vi.spyOn(store, "executeQuery").mockResolvedValue(
      success({
        columns: [
          {
            name: "device_m2",
            type_name: "STRUCT",
            type_text: WellKnownColumnTypes.DEVICE,
            position: 0,
          },
        ],
        rows: [['["thing-1","thing-1 (d1)"]'], [null]],
        totalRows: 2,
        truncated: false,
      }),
    );

    const result = await reads.runQuery({
      sql: "SELECT …",
      columns: [{ name: "device_m2", type: WellKnownColumnTypes.DEVICE, idOf: "device" }],
      distinct: false,
    });

    assertSuccess(result);
    expect(JSON.parse(String(result.value.rows[0][0]))).toMatchObject({ serial_number: "SN-1" });
    expect(result.value.rows[1][0]).toBeNull();
  });

  it("measures a read's contributors filled in, as the warehouse sends them", async () => {
    const ada = await testApp.createTestUser({ name: "Ada Lovelace" });
    storeRows(
      [
        {
          name: "contributor",
          type_name: "STRUCT",
          type_text: WellKnownColumnTypes.CONTRIBUTOR,
          position: 0,
        },
        { name: "device_name", type_name: "STRING", type_text: "STRING", position: 1 },
      ],
      // At the limit while the contributor is still its id.
      [[ada, "x".repeat(PAGE_BYTE_LIMIT - ada.length - 9)]],
    );

    const query = await reads.buildQuery({ ...page, columns: ["contributor", "device_name"] });
    assertSuccess(query);
    const result = await reads.runQuery(query.value);

    assertSuccess(result);
    expect(result.value.truncated).toBe(true);
  });

  it("types a Number question's answers as DOUBLE in its listing, as the warehouse's does", async () => {
    const userId = await testApp.createTestUser({});
    const { experiment } = await testApp.createExperiment({ name: "Heights", userId });
    const graph: FlowGraphDto = {
      nodes: [
        {
          id: "q1",
          type: "question",
          name: "Height",
          content: { kind: "number", text: "Plant height", required: false },
          isStart: true,
        },
      ],
      edges: [],
    };
    assertSuccess(await testApp.module.get(FlowRepository).create(experiment.id, graph));
    vi.spyOn(store, "getMetadataSheets").mockResolvedValue(success([]));
    vi.spyOn(store, "getExperimentTableMetadata").mockResolvedValue(
      success([
        {
          identifier: "raw_data",
          tableType: "static",
          displayName: null,
          rowCount: 3,
          latestRowAt: null,
          schemaRevision: "r1",
          questionsSchema: "OBJECT<height: STRING, plot: STRING>",
        },
      ]),
    );

    const result = await reads.tablesMetadata(experiment.id);

    assertSuccess(result);
    expect(result.value[0].questionsSchema).toBe("OBJECT<height: DOUBLE, plot: STRING>");
    expect(result.value[0].schemaRevision).toMatch(/^r1:[0-9a-f]{32}$/);
  });

  it("lists tables without answers without reading the flow, so a failed flow read cannot fail it", async () => {
    const uploads: ExperimentTableMetadata[] = [
      {
        identifier: "t1",
        tableType: "upload",
        displayName: "Weather",
        rowCount: 3,
        latestRowAt: null,
        schemaRevision: "r1",
        questionsSchema: null,
      },
    ];
    vi.spyOn(store, "getExperimentTableMetadata").mockResolvedValue(success(uploads));
    const flow = vi
      .spyOn(testApp.module.get(FlowRepository), "getByExperimentId")
      .mockResolvedValue(failure(AppError.internal("Flow lookup failed")));

    const result = await reads.tablesMetadata("e1");

    assertSuccess(result);
    expect(result.value).toEqual(uploads);
    expect(flow).not.toHaveBeenCalled();
  });

  it("lists a table the sheets match with their schema, and a revision that moves with them", async () => {
    vi.spyOn(store, "getExperimentTableMetadata").mockResolvedValue(
      success([
        {
          identifier: "raw_data",
          tableType: "static",
          displayName: null,
          rowCount: 3,
          latestRowAt: null,
          schemaRevision: "r1",
        },
      ]),
    );
    vi.spyOn(store, "getMetadataSheets").mockResolvedValue(
      success([{ id: "s1", matchOn: "plot", schema: "OBJECT<area: DECIMAL(2,1)>", version: "4" }]),
    );

    const result = await reads.tablesMetadata("e1");

    assertSuccess(result);
    expect(result.value[0].customMetadataSchema).toBe("OBJECT<area: DECIMAL(2,1)>");
    expect(result.value[0].schemaRevision).toMatch(/^r1:[0-9a-f]{32}$/);
  });

  it("hands the store the sheets for a read that shows or filters by a metadata field, and reads none for any other", async () => {
    const sheets = [{ id: "s1", matchOn: "plot", schema: "OBJECT<area: BIGINT>", version: "4" }];
    const read = vi.spyOn(store, "getMetadataSheets").mockResolvedValue(success(sheets));
    const build = vi.spyOn(store, "buildExperimentQuery");
    const metadata = { columnName: "custom_metadata", schema: "OBJECT<area: BIGINT>", suffix: "m" };
    const ids = { ...page, variants: [metadata], columns: ["id"] };

    assertSuccess(await reads.buildQuery({ ...page, variants: [metadata] }));
    assertSuccess(
      await reads.buildQuery({
        ...ids,
        filters: [{ column: "area", operator: "equals", value: 3 }],
      }),
    );
    assertSuccess(await reads.buildQuery(ids));
    assertSuccess(await reads.buildQuery(page));

    expect(read).toHaveBeenCalledTimes(2);
    expect(read).toHaveBeenCalledWith(page.experimentId);
    expect(build).toHaveBeenNthCalledWith(1, expect.objectContaining({ metadataSheets: sheets }));
    expect(build).toHaveBeenNthCalledWith(2, expect.objectContaining({ metadataSheets: sheets }));
    expect(build).toHaveBeenNthCalledWith(3, expect.objectContaining({ metadataSheets: [] }));
    expect(build).toHaveBeenNthCalledWith(4, expect.objectContaining({ metadataSheets: [] }));
  });

  it("hands the store the sheets for a joined read that shows a field of its second table's, and reads none for any other", async () => {
    const sheets = [{ id: "s1", matchOn: "plot", schema: "OBJECT<soil: STRING>", version: "4" }];
    const read = vi.spyOn(store, "getMetadataSheets").mockResolvedValue(success(sheets));
    const build = vi.spyOn(store, "buildExperimentQuery");
    const metadata = { columnName: "custom_metadata", schema: "OBJECT<soil: STRING>", suffix: "m" };
    const joined = (secondaryColumn: string): ExperimentQueryParams => ({
      ...page,
      columns: ["id", "second_column"],
      join: {
        secondary: { tableName: "mac1", tableType: "macro", variants: [metadata] },
        primaryColumns: ["id", "timestamp", "device_id"],
        secondaryColumns: [{ name: secondaryColumn, alias: "second_column" }],
        matchColumn: "device_id",
        primaryTimeColumn: "timestamp",
        primaryTimeType: "TIMESTAMP",
        secondaryTimeColumn: "timestamp",
        secondaryTimeType: "TIMESTAMP",
        toleranceMinutes: 60,
      },
    });

    assertSuccess(await reads.buildQuery(joined("soil")));
    assertSuccess(await reads.buildQuery(joined("id")));

    expect(read).toHaveBeenCalledOnce();
    expect(build).toHaveBeenNthCalledWith(1, expect.objectContaining({ metadataSheets: sheets }));
    expect(build).toHaveBeenNthCalledWith(2, expect.objectContaining({ metadataSheets: [] }));
  });

  it("hands the store the sheets for a chart that groups, partitions or matches by a metadata field it does not show", async () => {
    const schema = "OBJECT<plot_id: STRING>";
    const sheets = [{ id: "s1", matchOn: "plot", schema, version: "4" }];
    vi.spyOn(store, "getMetadataSheets").mockResolvedValue(success(sheets));
    const build = vi.spyOn(store, "buildExperimentQuery");
    const ids = {
      ...page,
      variants: [{ columnName: "custom_metadata", schema, suffix: "m" }],
      columns: ["id"],
    };

    assertSuccess(
      await reads.buildQuery({
        ...ids,
        aggregation: {
          groupBy: [{ column: "plot_id" }],
          functions: [{ column: "*", function: "count" }],
        },
      }),
    );
    assertSuccess(
      await reads.buildQuery({
        ...ids,
        aggregation: {
          functions: [
            {
              column: "id",
              function: "previous",
              partitionColumn: "plot_id",
              orderColumn: "timestamp",
            },
          ],
        },
      }),
    );
    // The second table holds the field in its payload, not its metadata.
    assertSuccess(
      await reads.buildQuery({
        ...ids,
        join: {
          secondary: {
            tableName: "mac1",
            tableType: "macro",
            variants: [{ columnName: "macro_output", schema, suffix: "output" }],
          },
          primaryColumns: ["id", "timestamp"],
          secondaryColumns: [{ name: "id", alias: "second_id" }],
          matchColumn: "plot_id",
          primaryTimeColumn: "timestamp",
          primaryTimeType: "TIMESTAMP",
          secondaryTimeColumn: "timestamp",
          secondaryTimeType: "TIMESTAMP",
          toleranceMinutes: 60,
        },
      }),
    );
    assertSuccess(
      await reads.buildQuery({
        ...ids,
        aggregation: {
          functions: [{ column: "id", function: "previous", orderColumn: "timestamp" }],
        },
      }),
    );

    expect(build).toHaveBeenCalledTimes(4);
    for (const call of [1, 2, 3]) {
      expect(build).toHaveBeenNthCalledWith(
        call,
        expect.objectContaining({ metadataSheets: sheets }),
      );
    }
    expect(build).toHaveBeenNthCalledWith(4, expect.objectContaining({ metadataSheets: [] }));
  });

  it("hands the store the sheets for a metadata field named like one of the store's own lists", async () => {
    const schema = "OBJECT<__order_ids: BIGINT>";
    const sheets = [{ id: "s1", matchOn: "plot", schema, version: "4" }];
    vi.spyOn(store, "getMetadataSheets").mockResolvedValue(success(sheets));
    const build = vi.spyOn(store, "buildExperimentQuery");
    const metadata = { columnName: "custom_metadata", schema, suffix: "m" };
    const ids = { ...page, variants: [metadata], columns: ["id"] };

    assertSuccess(await reads.buildQuery({ ...ids, columns: ["__order_ids_m"] }));
    assertSuccess(
      await reads.buildQuery({
        ...ids,
        filters: [{ column: "__order_ids_m", operator: "equals", value: 3 }],
      }),
    );
    assertSuccess(
      await reads.buildQuery({ ...ids, ordering: { column: "__order_ids_m", direction: "ASC" } }),
    );

    expect(build).toHaveBeenCalledTimes(3);
    for (const call of [1, 2, 3]) {
      expect(build).toHaveBeenNthCalledWith(
        call,
        expect.objectContaining({ metadataSheets: sheets }),
      );
    }
  });

  it("holds every table but the device table", () => {
    expect(reads.readsTable("raw_data")).toBe(true);
    expect(reads.readsTable("4f0c6b1e-macro")).toBe(true);
    expect(reads.readsTable("device")).toBe(false);
  });
});
