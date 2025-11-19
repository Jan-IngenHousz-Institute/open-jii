import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

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
    this.logger.debug("Loading Email configuration");
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
      this.logger.debug("Email configuration validated successfully");
    } catch {
      this.logger.error("Invalid Email configuration");
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
