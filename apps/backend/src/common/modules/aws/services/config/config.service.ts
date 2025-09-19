import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

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
    this.logger.debug("Loading AWS configuration");
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
      this.logger.debug("AWS configuration validated successfully");
    } catch (error) {
      this.logger.error("Invalid AWS configuration", error);
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
