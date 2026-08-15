import { ConfigService } from "@nestjs/config";

import { DuckDbConfigService } from "./duckdb-config.service";

const makeService = (config: Record<string, unknown>): DuckDbConfigService =>
  new DuckDbConfigService(new ConfigService(config));

describe("DuckDbConfigService", () => {
  it("defaults to the warehouse adapter with safe engine knobs", () => {
    const service = makeService({});

    expect(service.isDuckDbReadAdapter()).toBe(false);
    expect(service.isLocalMode()).toBe(false);
    expect(service.getMemoryLimit()).toBe("2GB");
    expect(service.getThreads()).toBe(2);
  });

  it("selects duckdb when the flag is set", () => {
    const service = makeService({ duckdb: { readAdapter: "duckdb", threads: "4" } });

    expect(service.isDuckDbReadAdapter()).toBe(true);
    expect(service.getThreads()).toBe(4);
  });

  it("does not throw at construction with empty databricks config", () => {
    expect(() => makeService({})).not.toThrow();
  });

  it("assertReady reports every missing table name at once", () => {
    const service = makeService({ databricks: { centrumSchemaName: "centrum" } });

    expect(() => service.assertReady()).toThrow(
      /DATABRICKS_RAW_DATA_TABLE_NAME.*DATABRICKS_DEVICE_DATA_TABLE_NAME.*DATABRICKS_MACRO_DATA_TABLE_NAME.*DATABRICKS_UPLOADED_DATA_TABLE_NAME/,
    );
  });

  it("assertReady passes with a complete configuration", () => {
    const service = makeService({
      databricks: {
        centrumSchemaName: "centrum",
        rawDataTableName: "r",
        deviceDataTableName: "d",
        macroDataTableName: "m",
        uploadedDataTableName: "u",
      },
    });

    expect(() => service.assertReady()).not.toThrow();
  });
});
