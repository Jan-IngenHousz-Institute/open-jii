import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AppError } from "../../../../utils/fp-utils";

/**
 * Engine knobs from duckdb.* plus catalog/schema/table names reused from the
 * databricks.* namespace. Deliberately lazy: nothing is validated at boot so
 * the app starts with warehouse-mode dummy envs; `assertAttachable()` runs at
 * first session init and reports every missing key at once.
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

  getHost(): string {
    return this.configService.get<string>("databricks.host") ?? "";
  }

  getCatalogName(): string {
    return this.configService.get<string>("databricks.catalogName") ?? "";
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

  /** Every key the UC ATTACH path needs; throws listing all gaps at once. */
  assertAttachable(): void {
    const required: [string, string][] = [
      ["DATABRICKS_HOST", this.getHost()],
      ["DATABRICKS_CATALOG_NAME", this.getCatalogName()],
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
