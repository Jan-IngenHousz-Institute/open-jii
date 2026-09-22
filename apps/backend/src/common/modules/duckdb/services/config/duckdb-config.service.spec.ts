import { ConfigService } from "@nestjs/config";

import { DuckDbConfigService } from "./duckdb-config.service";

const makeService = (config: Record<string, unknown>): DuckDbConfigService =>
  new DuckDbConfigService(new ConfigService(config));

describe("DuckDbConfigService", () => {
  it("falls back to safe engine knobs when nothing is configured", () => {
    const service = makeService({});

    expect(service.isLocalMode()).toBe(false);
    expect(service.getMemoryLimit()).toBe("2GB");
    expect(service.getThreads()).toBe(2);
  });

  it("takes the configured thread count", () => {
    const service = makeService({ duckdb: { threads: "4" } });

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
