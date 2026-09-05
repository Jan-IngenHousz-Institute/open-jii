import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { metricsContract } from "@repo/api/domains/metrics/metrics.contract";

import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { GetResourceMetricsUseCase } from "../application/use-cases/get-resource-metrics/get-resource-metrics";

@Controller()
export class ResourceMetricsController {
  private readonly logger = new Logger(ResourceMetricsController.name);

  constructor(private readonly getResourceMetricsUseCase: GetResourceMetricsUseCase) {}

  @Implement(metricsContract.getResourceMetrics)
  getResourceMetrics(@Session() session: UserSession) {
    return implement(metricsContract.getResourceMetrics).handler(async ({ input }) => {
      const result = await this.getResourceMetricsUseCase.execute(input.kind, session.user.id);

      if (result.isFailure()) {
        return throwOrpcFailure(result, this.logger, "getResourceMetrics");
      }

      return result.value;
    });
  }
}
