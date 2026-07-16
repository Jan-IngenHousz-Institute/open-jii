import { Controller, Logger, UseGuards } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

import { experimentProjectTransferWebhookContract } from "@repo/api/domains/experiment/project-transfer-webhook/experiment-project-transfer-webhook.contract";

import { HmacGuard } from "../../common/guards/hmac.guard";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { ExecuteProjectTransferUseCase } from "../application/use-cases/project-transfer/execute-project-transfer";

@Controller()
@AllowAnonymous()
@UseGuards(HmacGuard)
export class ProjectTransferWebhookController {
  private readonly logger = new Logger(ProjectTransferWebhookController.name);

  constructor(private readonly executeProjectTransferUseCase: ExecuteProjectTransferUseCase) {}

  @Implement(experimentProjectTransferWebhookContract.projectTransfer)
  handleProjectTransfer() {
    return implement(experimentProjectTransferWebhookContract.projectTransfer).handler(
      async ({ input }) => {
        const result = await this.executeProjectTransferUseCase.execute(input);

        if (result.isSuccess()) {
          return result.value;
        }

        return throwOrpcFailure(result, this.logger);
      },
    );
  }
}
