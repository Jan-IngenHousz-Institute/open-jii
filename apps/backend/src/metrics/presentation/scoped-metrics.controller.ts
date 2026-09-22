import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { metricsContract } from "@repo/api/domains/metrics/metrics.contract";

import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { GetScopedMetricsUseCase } from "../application/use-cases/get-scoped-metrics/get-scoped-metrics";

@Controller()
export class ScopedMetricsController {
  private readonly logger = new Logger(ScopedMetricsController.name);

  constructor(private readonly getScopedMetricsUseCase: GetScopedMetricsUseCase) {}

  @Implement(metricsContract.getScopedMetrics)
  getScopedMetrics(@Session() session: UserSession) {
    return implement(metricsContract.getScopedMetrics).handler(async ({ input }) => {
      const result = await this.getScopedMetricsUseCase.execute(
        input.scope,
        session.user.id,
        input.organizationId,
        input.experimentId,
      );

      if (result.isFailure()) {
        return throwOrpcFailure(result, this.logger, "getScopedMetrics");
      }

      return result.value;
    });
  }
}
