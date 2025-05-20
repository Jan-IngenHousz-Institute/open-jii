import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { SessionUser } from "@repo/auth/config";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { CreateExperimentUseCase } from "../application/use-cases/create-experiment/create-experiment";
import { DeleteExperimentUseCase } from "../application/use-cases/delete-experiment/delete-experiment";
import { GetExperimentUseCase } from "../application/use-cases/get-experiment/get-experiment";
import { ListExperimentsUseCase } from "../application/use-cases/list-experiments/list-experiments";
import { UpdateExperimentUseCase } from "../application/use-cases/update-experiment/update-experiment";
import { handleResult, Success } from "../utils/fp-utils";

@Controller()
@UseGuards(AuthGuard)
export class ExperimentController {
  private readonly logger = new Logger(ExperimentController.name);

  constructor(
    private readonly createExperimentUseCase: CreateExperimentUseCase,
    private readonly getExperimentUseCase: GetExperimentUseCase,
    private readonly listExperimentsUseCase: ListExperimentsUseCase,
    private readonly updateExperimentUseCase: UpdateExperimentUseCase,
    private readonly deleteExperimentUseCase: DeleteExperimentUseCase,
  ) {}

  @TsRestHandler(contract.experiments.createExperiment)
  async createExperiment(@CurrentUser() user: SessionUser) {
    return tsRestHandler(
      contract.experiments.createExperiment,
      async ({ body }) => {
        const result = await this.createExperimentUseCase.execute(
          body,
          user.id,
        );

        if (result.isSuccess()) {
          const experiment = (result as Success<any>).value;
          this.logger.log(
            `Experiment created: ${experiment.id} by user ${user.id}`,
          );
          return {
            status: StatusCodes.CREATED,
            body: experiment,
          };
        }

        return handleResult(result, this.logger);
      },
    );
  }

  @TsRestHandler(contract.experiments.getExperiment)
  async getExperiment() {
    return tsRestHandler(
      contract.experiments.getExperiment,
      async ({ params }) => {
        const result = await this.getExperimentUseCase.execute(params.id);
        return handleResult(result, this.logger);
      },
    );
  }

  @TsRestHandler(contract.experiments.listExperiments)
  async listExperiments(@CurrentUser() user: SessionUser) {
    return tsRestHandler(
      contract.experiments.listExperiments,
      async ({ query }) => {
        const result = await this.listExperimentsUseCase.execute(
          user.id,
          query.filter,
        );
        return handleResult(result, this.logger);
      },
    );
  }

  @TsRestHandler(contract.experiments.updateExperiment)
  async updateExperiment(@CurrentUser() user: SessionUser) {
    return tsRestHandler(
      contract.experiments.updateExperiment,
      async ({ params, body }) => {
        const result = await this.updateExperimentUseCase.execute(
          params.id,
          body,
        );

        if (result.isSuccess()) {
          this.logger.log(`Experiment ${params.id} updated by user ${user.id}`);
        }

        return handleResult(result, this.logger);
      },
    );
  }

  @TsRestHandler(contract.experiments.deleteExperiment)
  async deleteExperiment() {
    return tsRestHandler(
      contract.experiments.deleteExperiment,
      async ({ params }) => {
        const result = await this.deleteExperimentUseCase.execute(params.id);

        if (result.isSuccess()) {
          this.logger.log(`Experiment ${params.id} deleted`);
          return {
            status: StatusCodes.NO_CONTENT,
            body: null,
          };
        }

        return handleResult(result, this.logger);
      },
    );
  }
}
