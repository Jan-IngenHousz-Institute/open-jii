import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { User } from "@repo/auth/types";

import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { formatDates } from "../../../common/utils/date-formatter";
import { handleFailure } from "../../../common/utils/fp-utils";
import { CreateFlowWithStepsUseCase } from "../application/use-cases/create-flow-with-steps/create-flow-with-steps";
import { GetFlowByExperimentUseCase } from "../application/use-cases/get-flow-by-experiment/get-flow-by-experiment";
import { ListFlowsUseCase } from "../application/use-cases/list-flows/list-flows";
import { UpdateFlowWithStepsUseCase } from "../application/use-cases/update-flow-with-steps/update-flow-with-steps";

@Controller()
@UseGuards(AuthGuard)
export class FlowController {
  private readonly logger = new Logger(FlowController.name);

  constructor(
    private readonly createFlowWithStepsUseCase: CreateFlowWithStepsUseCase,
    private readonly getFlowByExperimentUseCase: GetFlowByExperimentUseCase,
    private readonly listFlowsUseCase: ListFlowsUseCase,
    private readonly updateFlowWithStepsUseCase: UpdateFlowWithStepsUseCase,
  ) {}

  @TsRestHandler(contract.flows.createFlowWithSteps)
  createFlowWithSteps(@CurrentUser() user: User) {
    return tsRestHandler(contract.flows.createFlowWithSteps, async ({ body }) => {
      const result = await this.createFlowWithStepsUseCase.execute(body, user.id);

      if (result.isSuccess()) {
        const flow = result.value;

        this.logger.log(`Flow with steps created: ${flow.id} by user ${user.id}`);

        // Format dates to strings and return directly (minimal transformation needed now)
        const formattedFlow = formatDates(flow);

        return {
          status: StatusCodes.CREATED,
          body: formattedFlow,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.flows.getFlowByExperiment)
  getFlowByExperiment() {
    return tsRestHandler(contract.flows.getFlowByExperiment, async ({ params }) => {
      const result = await this.getFlowByExperimentUseCase.execute(params.id);

      if (result.isSuccess()) {
        const flowWithGraph = result.value;

        // Format dates to strings and return directly (minimal transformation needed now)
        const formattedFlow = formatDates(flowWithGraph);

        this.logger.log(`Flow for experiment ${params.id} retrieved`);
        return {
          status: StatusCodes.OK,
          body: formattedFlow,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.flows.listFlows)
  listFlows() {
    return tsRestHandler(contract.flows.listFlows, async () => {
      const result = await this.listFlowsUseCase.execute();

      if (result.isSuccess()) {
        const flows = result.value;

        // Format dates to strings (minimal transformation needed now)
        const formattedFlows = flows.map((flow) => formatDates(flow));

        this.logger.log(`Listed ${flows.length} flows`);
        return {
          status: StatusCodes.OK,
          body: formattedFlows,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.flows.updateFlowWithSteps)
  updateFlowWithSteps(@CurrentUser() user: User) {
    return tsRestHandler(contract.flows.updateFlowWithSteps, async ({ params, body }) => {
      const result = await this.updateFlowWithStepsUseCase.execute(params.id, body);

      if (result.isSuccess()) {
        const flow = result.value;

        // Format dates to strings and return directly (minimal transformation needed now)
        const formattedFlow = formatDates(flow);

        this.logger.log(`Flow with steps ${params.id} updated by user ${user.id}`);
        return {
          status: StatusCodes.OK,
          body: formattedFlow,
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
