import { Controller, Logger, UseGuards } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

import { experimentUploadWebhookContract } from "@repo/api/domains/experiment/upload-webhook/experiment-upload-webhook.contract";

import { HmacGuard } from "../../common/guards/hmac.guard";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { NotifyUploadOutcomeUseCase } from "../application/use-cases/experiment-data-uploads/notify-upload-outcome";

@Controller()
@AllowAnonymous()
@UseGuards(HmacGuard)
export class ExperimentUploadWebhookController {
  private readonly logger = new Logger(ExperimentUploadWebhookController.name);

  constructor(private readonly notifyUploadOutcomeUseCase: NotifyUploadOutcomeUseCase) {}

  @Implement(experimentUploadWebhookContract.uploadOutcome)
  handleUploadOutcome() {
    return implement(experimentUploadWebhookContract.uploadOutcome).handler(async ({ input }) => {
      const result = await this.notifyUploadOutcomeUseCase.execute(input);

      if (result.isSuccess()) {
        return result.value;
      }

      return throwOrpcFailure(result, this.logger);
    });
  }
}
