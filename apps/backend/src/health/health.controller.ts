import { Controller, Get, Logger } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

@Controller("health")
@AllowAnonymous()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  @Get()
  check() {
    this.logger.log("Health check endpoint called");
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
