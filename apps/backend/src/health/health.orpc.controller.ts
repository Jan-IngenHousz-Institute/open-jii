import { Controller } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { healthOrpcContract } from "@repo/api/domains/health/health.orpc";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

@Controller()
@AllowAnonymous()
export class HealthOrpcController {
  @Implement(healthOrpcContract.getTime)
  getTime() {
    return implement(healthOrpcContract.getTime).handler(() => {
      const now = Date.now();
      return {
        utcTimestampMs: now,
        utcTimestampSec: Math.floor(now / 1000),
        iso: new Date(now).toISOString(),
      };
    });
  }
}
