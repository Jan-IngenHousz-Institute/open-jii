import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { experimentFlowsOrpcContract } from "@repo/api/domains/experiment/experiment-flows.orpc";

import { formatDates } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { CreateFlowUseCase } from "../application/use-cases/flows/create-flow";
import { GetFlowUseCase } from "../application/use-cases/flows/get-flow";
import { UpdateFlowUseCase } from "../application/use-cases/flows/update-flow";

@Controller()
export class ExperimentFlowsOrpcController {
  private readonly logger = new Logger(ExperimentFlowsOrpcController.name);

  constructor(
    private readonly getFlowUseCase: GetFlowUseCase,
    private readonly createFlowUseCase: CreateFlowUseCase,
    private readonly updateFlowUseCase: UpdateFlowUseCase,
  ) {}

  @Implement(experimentFlowsOrpcContract.getFlow)
  getFlow(@Session() session: UserSession) {
    return implement(experimentFlowsOrpcContract.getFlow).handler(async ({ input }) => {
      const result = await this.getFlowUseCase.execute(input.id, session.user.id);
      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentFlowsOrpcContract.createFlow)
  createFlow(@Session() session: UserSession) {
    return implement(experimentFlowsOrpcContract.createFlow).handler(async ({ input }) => {
      const { id, ...body } = input;
      const result = await this.createFlowUseCase.execute(id, session.user.id, body);
      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentFlowsOrpcContract.updateFlow)
  updateFlow(@Session() session: UserSession) {
    return implement(experimentFlowsOrpcContract.updateFlow).handler(async ({ input }) => {
      const { id, ...body } = input;
      const result = await this.updateFlowUseCase.execute(id, session.user.id, body);
      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }
}
