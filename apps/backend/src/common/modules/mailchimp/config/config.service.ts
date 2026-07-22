import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { ErrorCodes } from "../../../utils/error-codes";
import { MailchimpConfig, MailchimpCommunityKind, mailchimpConfigSchema } from "./config.types";

@Injectable()
export class MailchimpConfigService {
  private readonly logger = new Logger(MailchimpConfigService.name);
  private readonly config: MailchimpConfig | null;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfig();
  }

  /**
   * Loads and validates Mailchimp configuration. Returns `null` when no
   * Mailchimp env vars are present so the backend boots cleanly on
   * environments where the integration has not been provisioned yet. When any
   * value is present the whole config must be valid, otherwise startup fails
   * loudly (a partial/misconfigured integration is a deploy error).
   */
  private loadConfig(): MailchimpConfig | null {
    const raw = {
      apiKey: this.configService.get<string>("mailchimp.apiKey"),
      serverPrefix: this.configService.get<string>("mailchimp.serverPrefix"),
      audienceId: this.configService.get<string>("mailchimp.audienceId"),
      community: {
        kind: this.configService.get<MailchimpCommunityKind>("mailchimp.community.kind"),
        id: this.configService.get<string>("mailchimp.community.id"),
        name: this.configService.get<string>("mailchimp.community.name"),
      },
    };

    const anyPresent = [
      raw.apiKey,
      raw.serverPrefix,
      raw.audienceId,
      raw.community.kind,
      raw.community.id,
      raw.community.name,
    ].some((value) => value != null && value !== "");

    if (!anyPresent) {
      this.logger.warn({
        msg: "Mailchimp is not configured; newsletter operations will be unavailable",
        operation: "loadConfig",
      });
      return null;
    }

    const parsed = mailchimpConfigSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.error({
        msg: "Invalid Mailchimp configuration",
        errorCode: ErrorCodes.MAILCHIMP_CONFIG_INVALID,
        operation: "loadConfig",
      });
      throw new Error("Mailchimp configuration validation failed");
    }

    this.logger.debug({
      msg: "Mailchimp configuration validated successfully",
      operation: "loadConfig",
      status: "success",
    });
    return parsed.data;
  }

  get isConfigured(): boolean {
    return this.config !== null;
  }

  private getOrThrow(): MailchimpConfig {
    if (!this.config) {
      throw new Error("Mailchimp is not configured");
    }
    return this.config;
  }

  get apiKey(): string {
    return this.getOrThrow().apiKey;
  }

  get serverPrefix(): string {
    return this.getOrThrow().serverPrefix;
  }

  get audienceId(): string {
    return this.getOrThrow().audienceId;
  }

  get communityKind(): MailchimpCommunityKind {
    return this.getOrThrow().community.kind;
  }

  get communityId(): string {
    return this.getOrThrow().community.id;
  }

  get communityName(): string {
    return this.getOrThrow().community.name;
  }

  get baseUrl(): string {
    return `https://${this.getOrThrow().serverPrefix}.api.mailchimp.com/3.0`;
  }
}
