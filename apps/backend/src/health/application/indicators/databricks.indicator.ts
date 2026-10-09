import { Inject, Injectable } from "@nestjs/common";
import { HealthIndicatorService } from "@nestjs/terminus";
import type { HealthIndicatorResult } from "@nestjs/terminus";

import { HEALTH_DATABRICKS_PORT } from "../../core/ports/databricks.port";
import type { DatabricksPort } from "../../core/ports/databricks.port";

// Lists one job, which proves the workspace answers and accepts the API's credentials without
// starting the SQL warehouse.
@Injectable()
export class DatabricksHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(HEALTH_DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
  ) {}

  async check(): Promise<HealthIndicatorResult<"databricks">> {
    const indicator = this.healthIndicatorService.check("databricks");
    const result = await this.databricksPort.healthCheck();

    if (result.isFailure()) {
      return indicator.down({ reason: result.error.message });
    }

    return result.value.healthy
      ? indicator.up()
      : indicator.down({ reason: "The workspace reported itself unhealthy" });
  }
}
