import { WellKnownColumnTypes } from "@repo/api/domains/experiment/data/experiment-data.schema";

import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import { assertSuccess, success } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { ExperimentQueryParams } from "../../core/models/experiment-data.model";
import { SERVING_STORE_PORT } from "../../core/ports/serving-store.port";
import type { ServingStorePort } from "../../core/ports/serving-store.port";
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
    expect(build).toHaveBeenCalledWith(expect.objectContaining({ orderByIds: [ada, zoe] }));
    expect(query.value.sql).not.toContain("Lovelace");
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

  it("hands the store each device's serial number for a filter on one", async () => {
    const owner = await testApp.createTestUser({});
    await testApp.createIotDevice({ createdBy: owner, serialNumber: "SN-7", thingName: "thing-7" });
    vi.spyOn(store, "getExperimentIds").mockResolvedValue(success(["thing-7", "phone"]));
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
          ["phone", null],
        ],
      }),
    );
  });

  it("hands the store the serial numbers when a read lists devices' labels", async () => {
    vi.spyOn(store, "getExperimentIds").mockResolvedValue(success(["phone"]));
    const build = vi.spyOn(store, "buildExperimentQuery");

    await reads.buildQuery({ ...page, columns: ["device.serial_number"] });

    expect(build).toHaveBeenCalledWith(
      expect.objectContaining({ deviceSerials: [["phone", null]] }),
    );
  });

  it("sorts devices as Spark sorts their structs, registered ones by id and the rest by label", async () => {
    const owner = await testApp.createTestUser({});
    const first = await testApp.createIotDevice({ createdBy: owner, thingName: "thing-b" });
    const second = await testApp.createIotDevice({ createdBy: owner, thingName: "thing-c" });
    vi.spyOn(store, "getExperimentIds").mockResolvedValue(
      success(["thing-c", "phone-a", "thing-b"]),
    );
    const build = vi.spyOn(store, "buildExperimentQuery");

    await reads.buildQuery({ ...page, ordering: { column: "device" } });

    const byId = [
      { thing: "thing-b", id: first.id },
      { thing: "thing-c", id: second.id },
    ].sort((a, b) => (a.id < b.id ? -1 : 1));
    const [params] = build.mock.calls[0];
    expect(params.orderByIds).toEqual(byId.map(({ thing }) => thing));
    // The label that breaks the rest needs the serial numbers.
    expect(params.deviceSerials).toContainEqual(["phone-a", null]);
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

  it("holds every table but the device table", () => {
    expect(reads.readsTable("raw_data")).toBe(true);
    expect(reads.readsTable("4f0c6b1e-macro")).toBe(true);
    expect(reads.readsTable("device")).toBe(false);
  });
});
