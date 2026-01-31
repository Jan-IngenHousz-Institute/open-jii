import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { ErrorCodes } from "../../../../utils/error-codes";
import { DatabricksConfig, databricksConfigSchema } from "./config.types";

@Injectable()
export class DatabricksConfigService {
  private readonly logger = new Logger(DatabricksConfigService.name);
  private readonly config: DatabricksConfig;

  /**
   * Default timeout for HTTP requests in milliseconds
   */
  public static readonly DEFAULT_REQUEST_TIMEOUT = 30000;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  /**
   * Loads Databricks configuration from environment variables
   */
  private loadConfig(): DatabricksConfig {
    this.logger.debug({
      msg: "Loading Databricks configuration",
      operation: "loadConfig",
    });
    return {
      host: this.configService.getOrThrow<string>("databricks.host"),
      clientId: this.configService.getOrThrow<string>("databricks.clientId"),
      clientSecret: this.configService.getOrThrow<string>("databricks.clientSecret"),
      experimentProvisioningJobId: this.configService.getOrThrow<string>(
        "databricks.experimentProvisioningJobId",
      ),
      ambyteProcessingJobId: this.configService.getOrThrow<string>(
        "databricks.ambyteProcessingJobId",
      ),
      enrichedTablesRefreshJobId: this.configService.getOrThrow<string>(
        "databricks.enrichedTablesRefreshJobId",
      ),
      warehouseId: this.configService.getOrThrow<string>("databricks.warehouseId"),
      catalogName: this.configService.getOrThrow<string>("databricks.catalogName"),
      centrumSchemaName: this.configService.getOrThrow<string>("databricks.centrumSchemaName"),
      rawDataTableName: this.configService.getOrThrow<string>("databricks.rawDataTableName"),
      deviceDataTableName: this.configService.getOrThrow<string>("databricks.deviceDataTableName"),
      rawAmbyteDataTableName: this.configService.getOrThrow<string>(
        "databricks.rawAmbyteDataTableName",
      ),
      macroDataTableName: this.configService.getOrThrow<string>("databricks.macroDataTableName"),
    };
  }

  /**
   * Validates the loaded configuration
   */
  private validateConfig(): void {
    try {
      databricksConfigSchema.parse(this.config);
      this.logger.debug({
        msg: "Databricks configuration validated successfully",
        operation: "validateConfig",
        status: "success",
      });
    } catch {
      this.logger.error({
        msg: "Invalid Databricks configuration",
        errorCode: ErrorCodes.DATABRICKS_CONFIG_INVALID,
        operation: "validateConfig",
      });
      throw new Error("Invalid Databricks configuration: all fields must be non-empty strings");
    }
  }

  /**
   * Returns the current Databricks configuration
   */
  getConfig(): DatabricksConfig {
    return this.config;
  }

  /**
   * Returns the Databricks host URL
   */
  getHost(): string {
    return this.config.host;
  }

  /**
   * Returns the Databricks client ID
   */
  getClientId(): string {
    return this.config.clientId;
  }

  /**
   * Returns the Databricks client secret
   */
  getClientSecret(): string {
    return this.config.clientSecret;
  }

  /**
   * Returns the Databricks experiment provisioning job ID
   */
  getExperimentProvisioningJobId(): string {
    return this.config.experimentProvisioningJobId;
  }

  /**
   * Returns the Databricks experiment provisioning job ID as a number
   */
  getExperimentProvisioningJobIdAsNumber(): number {
    return parseInt(this.config.experimentProvisioningJobId, 10);
  }

  /**
   * Returns the Databricks ambyte processing job ID
   */
  getAmbyteProcessingJobId(): string {
    return this.config.ambyteProcessingJobId;
  }

  /**
   * Returns the Databricks ambyte processing job ID as a number
   */
  getAmbyteProcessingJobIdAsNumber(): number {
    return parseInt(this.config.ambyteProcessingJobId, 10);
  }

  /**
   * Returns the Databricks enriched tables refresh job ID
   */
  getEnrichedTablesRefreshJobId(): string {
    return this.config.enrichedTablesRefreshJobId;
  }

  /**
   * Returns the Databricks enriched tables refresh job ID as a number
   */
  getEnrichedTablesRefreshJobIdAsNumber(): number {
    return parseInt(this.config.enrichedTablesRefreshJobId, 10);
  }

  /**
   * Returns the Databricks warehouse ID
   */
  getWarehouseId(): string {
    return this.config.warehouseId;
  }

  /**
   * Returns the Databricks catalog name
   */
  getCatalogName(): string {
    return this.config.catalogName;
  }

  /**
   * Returns the centrum schema name
   */
  getCentrumSchemaName(): string {
    return this.config.centrumSchemaName;
  }

  /**
   * Returns the raw data table name
   */
  getRawDataTableName(): string {
    return this.config.rawDataTableName;
  }

  /**
   * Returns the device data table name
   */
  getDeviceDataTableName(): string {
    return this.config.deviceDataTableName;
  }

  /**
   * Returns the raw ambyte data table name
   */
  getRawAmbyteDataTableName(): string {
    return this.config.rawAmbyteDataTableName;
  }

  /**
   * Returns the macro data table name
   */
  getMacroDataTableName(): string {
    return this.config.macroDataTableName;
  }
}
