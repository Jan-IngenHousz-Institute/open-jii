import { Controller, Logger, UseGuards } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { HmacGuard } from "../../common/guards/hmac.guard";
import { handleFailure } from "../../common/utils/fp-utils";
import { ExecuteProjectTransferUseCase } from "../application/use-cases/project-transfer/execute-project-transfer";

@Controller()
@AllowAnonymous()
@UseGuards(HmacGuard)
export class ProjectTransferWebhookController {
  private readonly logger = new Logger(ProjectTransferWebhookController.name);

  constructor(private readonly executeProjectTransferUseCase: ExecuteProjectTransferUseCase) {}

  @TsRestHandler(contract.users.projectTransfer)
  handleProjectTransfer() {
    return tsRestHandler(contract.users.projectTransfer, async ({ body }) => {
      const result = await this.executeProjectTransferUseCase.execute(body);

      if (result.isSuccess()) {
        return {
          status: StatusCodes.CREATED as const,
          body: result.value,
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
