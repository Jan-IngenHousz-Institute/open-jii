import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AWS_CONFIG_INVALID } from "../../../../utils/error-codes";
import { AwsConfig, awsConfigSchema } from "./config.types";

@Injectable()
export class AwsConfigService {
  private readonly logger = new Logger(AwsConfigService.name);
  private readonly config: AwsConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  /**
   * Loads AWS configuration from environment variables
   */
  private loadConfig(): AwsConfig {
    this.logger.debug({
      msg: "Loading AWS configuration",
      operation: "loadConfig",
      context: AwsConfigService.name,
    });
    return {
      region: this.configService.getOrThrow<string>("aws.region"),
      placeIndexName: this.configService.getOrThrow<string>("aws.location.placeIndexName"),
    };
  }

  /**
   * Validates the loaded configuration
   */
  private validateConfig(): void {
    try {
      awsConfigSchema.parse(this.config);
      this.logger.debug({
        msg: "AWS configuration validated successfully",
        operation: "validateConfig",
        context: AwsConfigService.name,
        status: "success",
      });
    } catch (error) {
      this.logger.error({
        msg: "Invalid AWS configuration",
        errorCode: AWS_CONFIG_INVALID,
        operation: "validateConfig",
        context: AwsConfigService.name,
        error,
      });
      throw new Error(
        `AWS configuration validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Gets the AWS region
   */
  get region(): string {
    return this.config.region;
  }

  /**
   * Gets the place index name for AWS Location Service
   */
  get placeIndexName(): string {
    return this.config.placeIndexName;
  }
}
