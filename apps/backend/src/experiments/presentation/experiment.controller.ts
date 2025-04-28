import { Controller, Logger } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { CreateExperimentUseCase } from "../application/use-cases/create-experiment/create-experiment";
import { DeleteExperimentUseCase } from "../application/use-cases/delete-experiment/delete-experiment";
import { GetExperimentUseCase } from "../application/use-cases/get-experiment/get-experiment";
import { ListExperimentsUseCase } from "../application/use-cases/list-experiments/list-experiments";
import { UpdateExperimentUseCase } from "../application/use-cases/update-experiment/update-experiment";
import { handleResult, Success } from "../utils/fp-utils";

@Controller()
export class ExperimentController {
  private readonly logger = new Logger(ExperimentController.name);

  constructor(
    private readonly createExperimentUseCase: CreateExperimentUseCase,
    private readonly getExperimentUseCase: GetExperimentUseCase,
    private readonly listExperimentsUseCase: ListExperimentsUseCase,
    private readonly updateExperimentUseCase: UpdateExperimentUseCase,
    private readonly deleteExperimentUseCase: DeleteExperimentUseCase,
  ) {}

  @TsRestHandler(contract.createExperiment)
  async createExperiment() {
    return tsRestHandler(contract.createExperiment, async ({ body, query }) => {
      const userId = query.userId;
      const result = await this.createExperimentUseCase.execute(body, userId);

      if (result.isSuccess()) {
        const experiment = (result as Success<any>).value;
        this.logger.log(
          `Experiment created: ${experiment.id} by user ${query.userId}`,
        );
        return {
          status: StatusCodes.CREATED,
          body: experiment,
        };
      }

      return handleResult(result, this.logger);
    });
  }

  @TsRestHandler(contract.getExperiment)
  async getExperiment() {
    return tsRestHandler(contract.getExperiment, async ({ params }) => {
      const result = await this.getExperimentUseCase.execute(params.id);
      return handleResult(result, this.logger);
    });
  }

  @TsRestHandler(contract.listExperiments)
  async listExperiments() {
    return tsRestHandler(contract.listExperiments, async ({ query }) => {
      const result = await this.listExperimentsUseCase.execute(
        query.userId,
        query.filter,
      );
      return handleResult(result, this.logger);
    });
  }

  @TsRestHandler(contract.updateExperiment)
  async updateExperiment() {
    return tsRestHandler(
      contract.updateExperiment,
      async ({ params, body, query }) => {
        const result = await this.updateExperimentUseCase.execute(
          params.id,
          body,
        );

        if (result.isSuccess()) {
          this.logger.log(
            `Experiment ${params.id} updated by user ${query.userId}`,
          );
        }

        return handleResult(result, this.logger);
      },
    );
  }

  @TsRestHandler(contract.deleteExperiment)
  async deleteExperiment() {
    return tsRestHandler(
      contract.deleteExperiment,
      async ({ params, query }) => {
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
