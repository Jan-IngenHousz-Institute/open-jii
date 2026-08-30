import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { metricsContract } from "@repo/api/domains/metrics/metrics.contract";

import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { GetResourceActivityUseCase } from "../application/use-cases/get-resource-activity/get-resource-activity";

@Controller()
export class ResourceActivityController {
  private readonly logger = new Logger(ResourceActivityController.name);

  constructor(private readonly getResourceActivityUseCase: GetResourceActivityUseCase) {}

  @Implement(metricsContract.getResourceActivity)
  getResourceActivity(@Session() session: UserSession) {
    return implement(metricsContract.getResourceActivity).handler(async ({ input }) => {
      const result = await this.getResourceActivityUseCase.execute(input.kind, session.user.id);

      if (result.isFailure()) {
        return throwOrpcFailure(result, this.logger, "getResourceActivity");
      }

      return result.value;
    });
  }
}
