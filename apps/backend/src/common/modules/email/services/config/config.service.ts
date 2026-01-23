import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { ErrorCodes } from "../../../../utils/error-codes";
import { EmailConfig, emailConfigSchema } from "./config.types";

@Injectable()
export class EmailConfigService {
  private readonly logger = new Logger(EmailConfigService.name);
  private readonly config: EmailConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  /**
   * Loads Databricks configuration from environment variables
   */
  private loadConfig(): EmailConfig {
    this.logger.debug({
      msg: "Loading Email configuration",
      operation: "loadConfig",
    });
    return {
      baseUrl: this.configService.getOrThrow<string>("email.baseUrl"),
      server: this.configService.getOrThrow<string>("email.server"),
      from: this.configService.getOrThrow<string>("email.from"),
    };
  }

  /**
   * Validates the loaded configuration
   */
  private validateConfig(): void {
    try {
      emailConfigSchema.parse(this.config);
      this.logger.debug({
        msg: "Email configuration validated successfully",
        operation: "validateConfig",
        status: "success",
      });
    } catch {
      this.logger.error({
        msg: "Invalid Email configuration",
        errorCode: ErrorCodes.EMAIL_CONFIG_INVALID,
        operation: "validateConfig",
      });
      throw new Error("Invalid Email configuration: all fields must be non-empty strings");
    }
  }

  /**
   * Returns the current Email configuration
   */
  getConfig(): EmailConfig {
    return this.config;
  }

  /**
   * Returns the Base URL for the platform
   */
  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  /**
   * Returns the Email server
   */
  getServer(): string {
    return this.config.server;
  }

  /**
   * Returns the Email from address
   */
  getFrom(): string {
    return this.config.from;
  }
}
