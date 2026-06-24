import { Controller, Logger, UseGuards } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

import { experimentProjectTransferWebhookOrpcContract } from "@repo/api/domains/experiment/experiment-project-transfer-webhook.orpc";

import { HmacGuard } from "../../common/guards/hmac.guard";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { ExecuteProjectTransferUseCase } from "../application/use-cases/project-transfer/execute-project-transfer";

@Controller()
@AllowAnonymous()
@UseGuards(HmacGuard)
export class ProjectTransferWebhookOrpcController {
  private readonly logger = new Logger(ProjectTransferWebhookOrpcController.name);

  constructor(private readonly executeProjectTransferUseCase: ExecuteProjectTransferUseCase) {}

  @Implement(experimentProjectTransferWebhookOrpcContract.projectTransfer)
  handleProjectTransfer() {
    return implement(experimentProjectTransferWebhookOrpcContract.projectTransfer).handler(
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
