import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

import { metricsContract } from "@repo/api/domains/metrics/metrics.contract";

import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { GetPublicMetricsUseCase } from "../application/use-cases/get-public-metrics/get-public-metrics";

@Controller()
@AllowAnonymous()
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);

  constructor(private readonly getPublicMetricsUseCase: GetPublicMetricsUseCase) {}

  @Implement(metricsContract.getPublicMetrics)
  getPublicMetrics() {
    return implement(metricsContract.getPublicMetrics).handler(async () => {
      const result = await this.getPublicMetricsUseCase.execute();

      if (result.isFailure()) {
        return throwOrpcFailure(result, this.logger, "getPublicMetrics");
      }

      return result.value;
    });
  }
}
