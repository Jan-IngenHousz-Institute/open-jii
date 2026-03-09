import { Controller, Get, Logger } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

@Controller("health")
@AllowAnonymous()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  @Get()
  check() {
    this.logger.log({
      msg: "Health check endpoint called",
      operation: "check",
    });
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }

    @Get("time")
      getTime() {
        const now = new Date();
        this.logger.log({
          msg: "Time endpoint called",
          operation: "getTime",
          utcTimestamp: now.getTime(),
          iso: now.toISOString(),
        });
        return {
          utcTimestamp: now.getTime(),
          iso: now.toISOString(),
        };
      }
}
