import { Inject, Injectable } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";
import type { HealthIndicatorResult } from "@nestjs/terminus";

import { HEALTH_AWS_PORT } from "../../core/ports/aws.port";
import type { AwsPort } from "../../core/ports/aws.port";

@Injectable()
export class IotHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(HEALTH_AWS_PORT)
    private readonly awsPort: AwsPort,
  ) {}

  async check(): Promise<HealthIndicatorResult<"iot">> {
    const indicator = this.healthIndicatorService.check("iot");
    const result = await this.awsPort.probeIotEndpoint();

    return result.isSuccess() ? indicator.up() : indicator.down({ reason: result.error.message });
  }
}
