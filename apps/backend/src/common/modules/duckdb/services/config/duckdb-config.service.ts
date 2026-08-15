import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AppError } from "../../../../utils/fp-utils";

/**
 * Engine knobs from duckdb.* plus the physical table names, reused from the
 * databricks.* namespace rather than duplicated. Deliberately lazy: nothing
 * is validated at boot so the app starts with warehouse-mode dummy envs;
 * `assertReady()` runs at first use and reports every missing key at once.
 */
@Injectable()
export class DuckDbConfigService {
  constructor(private readonly configService: ConfigService) {}

  isDuckDbReadAdapter(): boolean {
    return this.configService.get<string>("duckdb.readAdapter") === "duckdb";
  }

  isLocalMode(): boolean {
    return this.configService.get<boolean>("duckdb.localMode") === true;
  }

  getMemoryLimit(): string {
    return this.configService.get<string>("duckdb.memoryLimit") ?? "2GB";
  }

  getThreads(): number {
    const raw = this.configService.get<string>("duckdb.threads") ?? "2";
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 2;
  }

  getExtensionDirectory(): string | undefined {
    return this.configService.get<string>("duckdb.extensionDirectory");
  }

  getTempDirectory(): string | undefined {
    return this.configService.get<string>("duckdb.tempDirectory");
  }

  getCentrumSchemaName(): string {
    return this.configService.get<string>("databricks.centrumSchemaName") ?? "";
  }

  getRawDataTableName(): string {
    return this.configService.get<string>("databricks.rawDataTableName") ?? "";
  }

  getDeviceDataTableName(): string {
    return this.configService.get<string>("databricks.deviceDataTableName") ?? "";
  }

  getMacroDataTableName(): string {
    return this.configService.get<string>("databricks.macroDataTableName") ?? "";
  }

  getUploadedDataTableName(): string {
    return this.configService.get<string>("databricks.uploadedDataTableName") ?? "";
  }

  /** Every table name the read path resolves; throws listing all gaps. */
  assertReady(): void {
    const required: [string, string][] = [
      ["DATABRICKS_CENTRUM_SCHEMA_NAME", this.getCentrumSchemaName()],
      ["DATABRICKS_RAW_DATA_TABLE_NAME", this.getRawDataTableName()],
      ["DATABRICKS_DEVICE_DATA_TABLE_NAME", this.getDeviceDataTableName()],
      ["DATABRICKS_MACRO_DATA_TABLE_NAME", this.getMacroDataTableName()],
      ["DATABRICKS_UPLOADED_DATA_TABLE_NAME", this.getUploadedDataTableName()],
    ];

    const missing = required.filter(([, value]) => value.length === 0).map(([name]) => name);
    if (missing.length > 0) {
      throw AppError.internal(
        `DuckDB read adapter is missing required configuration: ${missing.join(", ")}`,
        "DUCKDB_CONFIG_INVALID",
      );
    }
  }
}
