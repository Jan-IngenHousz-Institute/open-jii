import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { User } from "@repo/auth/types";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { formatDates } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
import { GetFlowUseCase } from "../application/use-cases/flows/get-flow";
import { UpsertFlowUseCase } from "../application/use-cases/flows/upsert-flow";

@Controller()
@UseGuards(AuthGuard)
export class ExperimentFlowsController {
  private readonly logger = new Logger(ExperimentFlowsController.name);

  constructor(
    private readonly getFlowUseCase: GetFlowUseCase,
    private readonly upsertFlowUseCase: UpsertFlowUseCase,
  ) {}

  @TsRestHandler(contract.experiments.getFlow)
  getFlow(@CurrentUser() user: User) {
    return tsRestHandler(contract.experiments.getFlow, async ({ params }) => {
      const result = await this.getFlowUseCase.execute(params.id, user.id);

      if (result.isSuccess()) {
        return {
          status: StatusCodes.OK as const,
          body: formatDates(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.upsertFlow)
  upsertFlow(@CurrentUser() user: User) {
    return tsRestHandler(contract.experiments.upsertFlow, async ({ params, body }) => {
      const result = await this.upsertFlowUseCase.execute(params.id, user.id, body);

      if (result.isSuccess()) {
        // Decide 200 vs 201 based on whether it previously existed
        // For simplicity, always return 200
        return {
          status: StatusCodes.OK as const,
          body: formatDates(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
