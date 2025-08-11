import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { User } from "@repo/auth/types";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { formatDates } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
import { CreateFlowUseCase } from "../application/use-cases/flows/create-flow";
import { GetFlowUseCase } from "../application/use-cases/flows/get-flow";
import { UpdateFlowUseCase } from "../application/use-cases/flows/update-flow";

@Controller()
@UseGuards(AuthGuard)
export class ExperimentFlowsController {
  private readonly logger = new Logger(ExperimentFlowsController.name);

  constructor(
    private readonly getFlowUseCase: GetFlowUseCase,
    private readonly createFlowUseCase: CreateFlowUseCase,
    private readonly updateFlowUseCase: UpdateFlowUseCase,
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

  @TsRestHandler(contract.experiments.createFlow)
  createFlow(@CurrentUser() user: User) {
    return tsRestHandler(contract.experiments.createFlow, async ({ params, body }) => {
      const result = await this.createFlowUseCase.execute(params.id, user.id, body);

      if (result.isSuccess()) {
        return {
          status: StatusCodes.CREATED as const,
          body: formatDates(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.updateFlow)
  updateFlow(@CurrentUser() user: User) {
    return tsRestHandler(contract.experiments.updateFlow, async ({ params, body }) => {
      const result = await this.updateFlowUseCase.execute(params.id, user.id, body);

      if (result.isSuccess()) {
        return {
          status: StatusCodes.OK as const,
          body: formatDates(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
