import { Inject, Injectable } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";
import type { HealthIndicatorResult } from "@nestjs/terminus";

import { HEALTH_EMAIL_PORT } from "../../core/ports/email.port";
import type { EmailPort } from "../../core/ports/email.port";

// Logs in with the backend's own email setting. Sign-in codes use a separate setting, which holds
// the same SES login today.
@Injectable()
export class EmailHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(HEALTH_EMAIL_PORT)
    private readonly emailPort: EmailPort,
  ) {}

  async check(): Promise<HealthIndicatorResult<"email">> {
    const indicator = this.healthIndicatorService.check("email");
    const result = await this.emailPort.verifyTransport();

    return result.isSuccess() ? indicator.up() : indicator.down({ reason: result.error.message });
  }
}
