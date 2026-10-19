import { Controller, Logger, UseGuards } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

import { experimentExportCarryOverWebhookContract } from "@repo/api/domains/experiment/export-carry-over-webhook/experiment-export-carry-over-webhook.contract";

import { HmacGuard } from "../../common/guards/hmac.guard";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { CarryOverExportsUseCase } from "../application/use-cases/experiment-data-exports/carry-over-exports";

@Controller()
@AllowAnonymous()
@UseGuards(HmacGuard)
export class ExperimentExportCarryOverWebhookController {
  private readonly logger = new Logger(ExperimentExportCarryOverWebhookController.name);

  constructor(private readonly carryOverExportsUseCase: CarryOverExportsUseCase) {}

  @Implement(experimentExportCarryOverWebhookContract.carryOverExports)
  handleCarryOver() {
    return implement(experimentExportCarryOverWebhookContract.carryOverExports).handler(
      async ({ input }) => {
        const result = await this.carryOverExportsUseCase.execute(input);

        if (result.isSuccess()) {
          return result.value;
        }

        return throwOrpcFailure(result, this.logger);
      },
    );
  }
}
