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

  it("assertAttachable reports every missing key at once", () => {
    const service = makeService({
      databricks: { host: "https://x", catalogName: "cat" },
    });

    expect(() => service.assertAttachable()).toThrow(
      /DATABRICKS_CENTRUM_SCHEMA_NAME.*DATABRICKS_RAW_DATA_TABLE_NAME.*DATABRICKS_DEVICE_DATA_TABLE_NAME.*DATABRICKS_MACRO_DATA_TABLE_NAME.*DATABRICKS_UPLOADED_DATA_TABLE_NAME/,
    );
  });

  it("assertAttachable passes with a complete configuration", () => {
    const service = makeService({
      databricks: {
        host: "https://x",
        catalogName: "cat",
        centrumSchemaName: "centrum",
        rawDataTableName: "r",
        deviceDataTableName: "d",
        macroDataTableName: "m",
        uploadedDataTableName: "u",
      },
    });

    expect(() => service.assertAttachable()).not.toThrow();
  });
});
