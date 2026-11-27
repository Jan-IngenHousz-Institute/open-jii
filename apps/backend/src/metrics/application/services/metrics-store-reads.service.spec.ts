import { DatabricksAdapter } from "../../../common/modules/databricks/databricks.adapter";
import { ServingStoreClientService } from "../../../common/modules/serving-store/services/client/client.service";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../common/utils/fp-utils";
import type { Result } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { MetricsReads } from "../../core/ports/metrics-reads.port";
import { MetricsStoreReadsService } from "./metrics-store-reads.service";

/** A metrics table as the warehouse writes it: every cell text, in its own column order. */
interface WarehouseTable {
  columns: string[];
  rows: (string | null)[][];
}

/** The same figures in the store's view, as the store sends them: numbers bare, times to the
 *  microsecond, and a NaN double quoted. */
type StoreView = Record<string, unknown>[];

const WAREHOUSE: Record<string, WarehouseTable> = {
  platform_totals: {
    columns: [
      "total_measurements",
      "total_volume_bytes",
      "devices_all_time",
      "experiments_with_data",
      "first_measurement_at",
      "last_measurement_at",
      "total_macro_executions",
      "total_uploaded_rows",
      "computed_at",
    ],
    rows: [
      [
        "1000",
        "949000",
        "9",
        "5",
        "2024-01-01T00:00:00Z",
        "2026-08-28T10:00:00.123Z",
        "200",
        "50",
        "2026-08-28T11:07:00Z",
      ],
    ],
  },
  daily_activity: {
    columns: ["date", "measurements", "cumulative_measurements", "volume_bytes", "computed_at"],
    rows: [
      ["2026-08-28", "120", "1000", "2400", "2026-08-28T11:07:00Z"],
      ["2026-08-27", "80", "880", "1600", "2026-08-28T11:07:00Z"],
    ],
  },
  activity_windows: {
    columns: [
      "measurements_24h",
      "measurements_7d",
      "measurements_30d",
      "experiments_30d",
      "contributors_30d",
      "devices_30d",
      "last_measurement_at",
      "computed_at",
    ],
    rows: [
      ["140", "900", "4812", "23", "31", "12", "2026-08-28T10:00:00.123Z", "2026-08-28T11:07:00Z"],
    ],
  },
  hourly_activity: {
    columns: ["hour_local", "measurements", "computed_at"],
    rows: [
      ["0", "10", "2026-08-28T11:07:00Z"],
      ["12", "300", "2026-08-28T11:07:00Z"],
    ],
  },
  parameter_stats: {
    columns: ["parameter", "label", "category", "observations", "median_value", "computed_at"],
    rows: [["Phi2", "Photosystem II efficiency (Phi2)", "derived", "4214", "0.62", "x"]],
  },
  pool_facts: {
    columns: [
      "session_median_measurements",
      "device_endurance_days",
      "simultaneity_peak_devices",
      "timezones_all_time",
      "timezones_peak_day",
      "mean_arrival_gap_seconds",
      "current_streak_days",
      "computed_at",
    ],
    rows: [["45", null, "14", "14", "9", "0.25", "12", "2026-08-28T11:07:00Z"]],
  },
  daily_activity_by_experiment: {
    columns: ["date", "experiment_id", "measurements", "active_devices", "computed_at"],
    rows: [
      ["2026-08-27", "e1", "300", "2", "x"],
      ["2026-08-28", "e2", "20", "1", "x"],
    ],
  },
  daily_activity_by_resource: {
    columns: ["date", "resource_type", "resource_id", "measurements", "computed_at"],
    rows: [
      ["2026-08-27", "protocol", "p1", "10", "x"],
      ["2026-08-28", "protocol", "p1", "12", "x"],
    ],
  },
  experiment_contributors_window: {
    columns: ["experiment_id", "user_id", "computed_at"],
    rows: [
      ["e1", "u1", "x"],
      ["e2", "u2", "x"],
    ],
  },
  experiment_devices_window: {
    columns: ["experiment_id", "client_id", "computed_at"],
    rows: [
      ["e1", "thing-1", "x"],
      ["e2", "thing-2", "x"],
    ],
  },
};

const STORE: Record<string, StoreView> = {
  metrics_platform_totals: [
    {
      total_measurements: 1000,
      total_volume_bytes: 949000,
      total_uploaded_rows: 50,
      total_macro_executions: 200,
      devices_all_time: 9,
      experiments_with_data: 5,
      first_measurement_at: "2024-01-01 00:00:00.000000",
      last_measurement_at: "2026-08-28 10:00:00.123456",
      computed_at: "2026-08-28 11:07:00.000000",
    },
  ],
  metrics_daily_activity: [
    { date: "2026-08-28", measurements: 120, cumulative_measurements: 1000, volume_bytes: 2400 },
    { date: "2026-08-27", measurements: 80, cumulative_measurements: 880, volume_bytes: 1600 },
  ],
  metrics_activity_windows: [
    {
      measurements_24h: 140,
      measurements_30d: 4812,
      experiments_30d: 23,
      contributors_30d: 31,
      devices_30d: 12,
      last_measurement_at: "2026-08-28 10:00:00.123456",
      computed_at: "2026-08-28 11:07:00.000000",
    },
  ],
  metrics_hourly_activity: [
    { hour_local: 0, measurements: 10 },
    { hour_local: 12, measurements: 300 },
  ],
  metrics_parameter_stats: [
    { parameter: "", label: "", observations: 0, median_value: "nan" },
    {
      parameter: "Phi2",
      label: "Photosystem II efficiency (Phi2)",
      observations: 4214,
      median_value: 0.62,
    },
  ],
  metrics_pool_facts: [
    {
      session_median_measurements: 45,
      mean_arrival_gap_seconds: 0.25,
      current_streak_days: 12,
      device_endurance_days: null,
      simultaneity_peak_devices: 14,
      timezones_all_time: 14,
      timezones_peak_day: 9,
    },
  ],
  metrics_daily_activity_by_experiment: [
    { date: "2026-08-27", experiment_id: "e1", measurements: 300 },
    { date: "2026-08-28", experiment_id: "e2", measurements: 20 },
  ],
  metrics_daily_activity_by_resource: [
    { date: "2026-08-27", resource_type: "protocol", resource_id: "p1", measurements: 10 },
    { date: "2026-08-28", resource_type: "protocol", resource_id: "p1", measurements: 12 },
  ],
  metrics_experiment_contributors_window: [
    { experiment_id: "e1", user_id: "u1" },
    { experiment_id: "e2", user_id: "u2" },
  ],
  metrics_experiment_devices_window: [
    { experiment_id: "e1", client_id: "thing-1" },
    { experiment_id: "e2", client_id: "thing-2" },
  ],
};

const READS: [string, (reads: MetricsReads) => Promise<Result<unknown>>, unknown][] = [
  [
    "platform totals",
    (reads) => reads.getPublicPlatformTotals(),
    {
      totalMeasurements: 1000,
      totalVolumeBytes: 949000,
      totalUploadedRows: 50,
      totalMacroExecutions: 200,
      devicesAllTime: 9,
      experimentsWithData: 5,
      firstMeasurementAt: "2024-01-01T00:00:00.000Z",
      lastMeasurementAt: "2026-08-28T10:00:00.123Z",
      computedAt: "2026-08-28T11:07:00.000Z",
    },
  ],
  [
    "daily activity",
    (reads) => reads.getPublicDailyActivity(366),
    [
      { date: "2026-08-27", measurements: 80, cumulativeMeasurements: 880, volumeBytes: 1600 },
      { date: "2026-08-28", measurements: 120, cumulativeMeasurements: 1000, volumeBytes: 2400 },
    ],
  ],
  [
    "activity windows",
    (reads) => reads.getActivityWindows(),
    {
      measurements24h: 140,
      measurements30d: 4812,
      experiments30d: 23,
      contributors30d: 31,
      devices30d: 12,
      lastMeasurementAt: "2026-08-28T10:00:00.123Z",
      computedAt: "2026-08-28T11:07:00.000Z",
    },
  ],
  [
    "hourly activity",
    (reads) => reads.getHourlyActivity(),
    [
      { hourLocal: 0, measurements: 10 },
      { hourLocal: 12, measurements: 300 },
    ],
  ],
  [
    "top parameter",
    (reads) => reads.getTopParameter("derived"),
    { label: "Photosystem II efficiency (Phi2)", name: "Phi2", observations: 4214, median: 0.62 },
  ],
  [
    "pool facts",
    (reads) => reads.getPoolFacts(),
    {
      sessionMedianMeasurements: 45,
      meanArrivalGapSeconds: 0.25,
      currentStreakDays: 12,
      deviceEnduranceDays: null,
      simultaneityPeakDevices: 14,
      timezonesAllTime: 14,
      timezonesPeakDay: 9,
    },
  ],
  [
    "experiment daily activity",
    (reads) => reads.getScopedDailyActivity(60),
    [
      { date: "2026-08-27", experimentId: "e1", measurements: 300 },
      { date: "2026-08-28", experimentId: "e2", measurements: 20 },
    ],
  ],
  [
    "resource daily activity",
    (reads) => reads.getResourceDailyActivity("protocol", 60),
    [
      { date: "2026-08-27", resourceType: "protocol", resourceId: "p1", measurements: 10 },
      { date: "2026-08-28", resourceType: "protocol", resourceId: "p1", measurements: 12 },
    ],
  ],
  [
    "contributor pairs",
    (reads) => reads.getContributorPairs(),
    [
      { experimentId: "e1", userId: "u1" },
      { experimentId: "e2", userId: "u2" },
    ],
  ],
  [
    "device pairs",
    (reads) => reads.getDevicePairs(),
    [
      { experimentId: "e1", clientId: "thing-1" },
      { experimentId: "e2", clientId: "thing-2" },
    ],
  ],
];

describe("MetricsStoreReadsService", () => {
  const testApp = TestHarness.App;
  let storeReads: MetricsStoreReadsService;
  let warehouse: DatabricksAdapter;
  let storeClient: ServingStoreClientService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    storeReads = testApp.module.get(MetricsStoreReadsService);
    warehouse = testApp.module.get(DatabricksAdapter);
    storeClient = testApp.module.get(ServingStoreClientService);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  function warehouseAnswers(tables: Record<string, WarehouseTable>) {
    return vi.spyOn(warehouse, "executeSqlQuery").mockImplementation((_schema, sql) => {
      const table = tables[/FROM \S+\.(\w+)/.exec(sql)?.[1] ?? ""];
      const columns = table.columns.map((name, position) => ({
        name,
        type_name: "STRING",
        type_text: "STRING",
        position,
      }));
      return Promise.resolve(
        success({ columns, rows: table.rows, totalRows: table.rows.length, truncated: false }),
      );
    });
  }

  /** Each view's rows in the columns the read selects, whatever else it holds. */
  function storeAnswers(views: Record<string, StoreView>) {
    return vi.spyOn(storeClient, "query").mockImplementation((sql) => {
      const [, selected, view] = /^SELECT (.+?) FROM (\w+)/.exec(sql) ?? ["", "", ""];
      const columns = selected.split(", ");
      const rows = views[view].map((row) => columns.map((column) => row[column]));
      return Promise.resolve(success({ rows }));
    });
  }

  it.each(READS)("reads the same %s as the warehouse", async (_name, read, expected) => {
    const warehouseRead = warehouseAnswers(WAREHOUSE);
    const storeRead = storeAnswers(STORE);

    const fromWarehouse = await read(warehouse);
    expect(storeRead).not.toHaveBeenCalled();

    warehouseRead.mockClear();
    const fromStore = await read(storeReads);
    expect(warehouseRead).not.toHaveBeenCalled();

    assertSuccess(fromWarehouse);
    assertSuccess(fromStore);
    expect(fromWarehouse.value).toEqual(expected);
    expect(fromStore.value).toEqual(expected);
  });

  it("reads a refreshed view where no parameter qualified as none, as the warehouse reads an empty table", async () => {
    warehouseAnswers({
      parameter_stats: {
        columns: ["parameter", "label", "observations", "median_value"],
        rows: [],
      },
    });
    storeAnswers({
      metrics_parameter_stats: [{ parameter: "", label: "", observations: 0, median_value: "nan" }],
    });

    const fromWarehouse = await warehouse.getTopParameter("sensor");
    const fromStore = await storeReads.getTopParameter("sensor");

    assertSuccess(fromWarehouse);
    assertSuccess(fromStore);
    expect(fromWarehouse.value).toBeNull();
    expect(fromStore.value).toBeNull();
  });

  it("fails a parameter read before the view's first refresh, rather than reading it as none", async () => {
    storeAnswers({ metrics_parameter_stats: [] });

    assertFailure(await storeReads.getTopParameter("sensor"));
  });

  it("reads a NaN median as no figure, as the warehouse does", async () => {
    const nan = {
      parameter: "temperature",
      label: "Temperature",
      observations: 12,
      median_value: "nan",
    };
    warehouseAnswers({
      parameter_stats: {
        columns: ["parameter", "label", "observations", "median_value"],
        rows: [["temperature", "Temperature", "12", "NaN"]],
      },
    });
    const storeRead = storeAnswers({ metrics_parameter_stats: [nan] });

    const fromWarehouse = await warehouse.getTopParameter("sensor");
    const fromStore = await storeReads.getTopParameter("sensor");

    assertSuccess(fromWarehouse);
    assertSuccess(fromStore);
    expect(fromWarehouse.value).toBeNull();
    expect(fromStore.value).toBeNull();
    expect(storeRead).toHaveBeenCalledTimes(1);
  });

  it("sums the store's clients into the registry's families, as the pipeline's table holds them", async () => {
    const owner = await testApp.createTestUser({});
    await testApp.createIotDevice({
      createdBy: owner,
      thingName: "thing-1",
      deviceType: "multispeq",
    });
    await testApp.createIotDevice({
      createdBy: owner,
      thingName: "thing-2",
      deviceType: "multispeq",
    });
    await testApp.createIotDevice({ createdBy: owner, thingName: "thing-3", deviceType: "ambit" });
    warehouseAnswers({
      family_totals: {
        columns: ["family", "total_measurements", "devices_all_time", "computed_at"],
        rows: [
          ["multispeq", "900", "2", "x"],
          ["ambit", "60", "1", "x"],
          ["unattributed", "40", "2", "x"],
        ],
      },
    });
    const storeRead = storeAnswers({
      metrics_client_totals: [
        { client_id: "thing-1", total_measurements: 500 },
        { client_id: "unregistered", total_measurements: 25 },
        { client_id: "thing-3", total_measurements: 60 },
        { client_id: "thing-2", total_measurements: 400 },
        { client_id: null, total_measurements: 15 },
      ],
    });

    const fromWarehouse = await warehouse.getPublicFamilyTotals();
    const fromStore = await storeReads.getPublicFamilyTotals();

    const families = [
      { family: "multispeq", measurements: 900 },
      { family: "ambit", measurements: 60 },
      { family: "unattributed", measurements: 40 },
    ];
    assertSuccess(fromWarehouse);
    assertSuccess(fromStore);
    expect(fromWarehouse.value).toEqual(families);
    expect(fromStore.value).toEqual(families);
    expect(storeRead).toHaveBeenCalledTimes(1);
  });

  it("picks the same parameter of two observed alike, whatever order each source reads them in", async () => {
    warehouseAnswers({
      parameter_stats: {
        columns: ["parameter", "label", "observations", "median_value"],
        rows: [
          ["temperature", "Temperature", "12", "21.5"],
          ["humidity", "Relative humidity", "12", "55.0"],
        ],
      },
    });
    storeAnswers({
      metrics_parameter_stats: [
        { parameter: "humidity", label: "Relative humidity", observations: 12, median_value: 55 },
        { parameter: "temperature", label: "Temperature", observations: 12, median_value: 21.5 },
      ],
    });

    const fromWarehouse = await warehouse.getTopParameter("sensor");
    const fromStore = await storeReads.getTopParameter("sensor");

    const humidity = { label: "Relative humidity", name: "humidity", observations: 12, median: 55 };
    assertSuccess(fromWarehouse);
    assertSuccess(fromStore);
    expect(fromWarehouse.value).toEqual(humidity);
    expect(fromStore.value).toEqual(humidity);
  });

  it("orders two families of one count alike, whatever order each source reads them in", async () => {
    const owner = await testApp.createTestUser({});
    await testApp.createIotDevice({ createdBy: owner, thingName: "thing-a", deviceType: "ambit" });
    await testApp.createIotDevice({
      createdBy: owner,
      thingName: "thing-m",
      deviceType: "multispeq",
    });
    warehouseAnswers({
      family_totals: {
        columns: ["family", "total_measurements"],
        rows: [
          ["multispeq", "50"],
          ["ambit", "50"],
        ],
      },
    });
    storeAnswers({
      metrics_client_totals: [
        { client_id: "thing-a", total_measurements: 50 },
        { client_id: "thing-m", total_measurements: 50 },
      ],
    });

    const fromWarehouse = await warehouse.getPublicFamilyTotals();
    const fromStore = await storeReads.getPublicFamilyTotals();

    const families = [
      { family: "ambit", measurements: 50 },
      { family: "multispeq", measurements: 50 },
    ];
    assertSuccess(fromWarehouse);
    assertSuccess(fromStore);
    expect(fromWarehouse.value).toEqual(families);
    expect(fromStore.value).toEqual(families);
  });

  it("passes a store failure through rather than reading the warehouse", async () => {
    const warehouseRead = warehouseAnswers(WAREHOUSE);
    vi.spyOn(storeClient, "query").mockResolvedValue(
      failure(AppError.internal("The serving store could not answer the read")),
    );

    const totals = await storeReads.getPublicPlatformTotals();
    const families = await storeReads.getPublicFamilyTotals();

    assertFailure(totals);
    assertFailure(families);
    expect(warehouseRead).not.toHaveBeenCalled();
  });
});
