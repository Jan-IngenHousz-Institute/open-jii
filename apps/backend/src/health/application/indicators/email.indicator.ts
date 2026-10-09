import { Inject, Injectable } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";
import type { HealthIndicatorResult } from "@nestjs/terminus";

import { HEALTH_EMAIL_PORT } from "../../core/ports/email.port";
import type { EmailPort } from "../../core/ports/email.port";

// Sign-in codes and invitations travel over this login, so a refused one blocks sign-ups.
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
