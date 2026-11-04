import { Controller, Logger, UseGuards } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

import { experimentDataContract } from "@repo/api/domains/experiment/data/experiment-data.contract";

import { HmacGuard } from "../../common/guards/hmac.guard";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { ExperimentQuestionTypesRepository } from "../core/repositories/experiment-question-types.repository";

@Controller()
@AllowAnonymous()
@UseGuards(HmacGuard)
export class ExperimentQuestionTypesWebhookController {
  private readonly logger = new Logger(ExperimentQuestionTypesWebhookController.name);

  constructor(private readonly questionTypes: ExperimentQuestionTypesRepository) {}

  @Implement(experimentDataContract.getExperimentQuestionTypes)
  getQuestionTypes() {
    return implement(experimentDataContract.getExperimentQuestionTypes).handler(
      async ({ input }) => {
        const result = await this.questionTypes.activeNumericKeysForExperiments(
          input.experimentIds,
        );
        if (result.isFailure()) return throwOrpcFailure(result, this.logger);
        return { success: true, experiments: result.value };
      },
    );
  }
}
