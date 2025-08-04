import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

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
    this.logger.debug("Loading Databricks configuration");
    return {
      host: this.configService.getOrThrow<string>("databricks.host"),
      clientId: this.configService.getOrThrow<string>("databricks.clientId"),
      clientSecret: this.configService.getOrThrow<string>("databricks.clientSecret"),
      jobId: this.configService.getOrThrow<string>("databricks.jobId"),
      warehouseId: this.configService.getOrThrow<string>("databricks.warehouseId"),
      catalogName: this.configService.getOrThrow<string>("databricks.catalogName"),
    };
  }

  /**
   * Validates the loaded configuration
   */
  private validateConfig(): void {
    try {
      databricksConfigSchema.parse(this.config);
      this.logger.debug("Databricks configuration validated successfully");
    } catch {
      this.logger.error("Invalid Databricks configuration");
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
   * Returns the Databricks job ID
   */
  getJobId(): string {
    return this.config.jobId;
  }

  /**
   * Returns the Databricks job ID as a number
   */
  getJobIdAsNumber(): number {
    return parseInt(this.config.jobId, 10);
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
}
