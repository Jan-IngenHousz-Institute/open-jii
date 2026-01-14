import { Controller, Get, Logger } from "@nestjs/common";

@Controller("health")
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  @Get()
  check() {
    this.logger.log({
      msg: "Health check endpoint called",
      operation: "check",
      context: HealthController.name,
    });
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
