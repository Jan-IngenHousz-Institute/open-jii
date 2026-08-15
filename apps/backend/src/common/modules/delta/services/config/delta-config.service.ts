import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AppError } from "../../../../utils/fp-utils";

/**
 * Delta Sharing connection settings. Deliberately lazy: nothing is validated
 * at boot so the app starts with warehouse-mode dummy envs; `assertReady()`
 * runs at first use and reports every missing key at once.
 */
@Injectable()
export class DeltaConfigService {
  static readonly DEFAULT_REQUEST_TIMEOUT = 30000;

  constructor(private readonly configService: ConfigService) {}

  getEndpoint(): string {
    return this.configService.get<string>("delta.endpoint") ?? "";
  }

  getBearerToken(): string {
    return this.configService.get<string>("delta.bearerToken") ?? "";
  }

  getShareName(): string {
    return this.configService.get<string>("delta.shareName") ?? "";
  }

  getSchemaName(): string {
    return this.configService.get<string>("delta.schemaName") ?? "centrum";
  }

  getRequestTimeout(): number {
    const raw = this.configService.get<string>("delta.requestTimeout");
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DeltaConfigService.DEFAULT_REQUEST_TIMEOUT;
  }

  /** Every key the sharing client needs; throws listing all gaps at once. */
  assertReady(): void {
    const required: [string, string][] = [
      ["DELTA_ENDPOINT", this.getEndpoint()],
      ["DELTA_BEARER_TOKEN", this.getBearerToken()],
      ["DELTA_SHARE_NAME", this.getShareName()],
    ];

    const missing = required.filter(([, value]) => value.length === 0).map(([name]) => name);
    if (missing.length > 0) {
      throw AppError.internal(
        `Delta Sharing is missing required configuration: ${missing.join(", ")}`,
        "DELTA_CONFIG_INVALID",
      );
    }
  }
}
