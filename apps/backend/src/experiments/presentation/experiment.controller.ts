import { Controller, Logger } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/contracts";

import { ChangeExperimentStatusUseCase } from "../application/use-cases/change-experiment-status/change-experiment-status";
import { CreateExperimentUseCase } from "../application/use-cases/create-experiment/create-experiment";
import { DeleteExperimentUseCase } from "../application/use-cases/delete-experiment/delete-experiment";
import { GetExperimentUseCase } from "../application/use-cases/get-experiment/get-experiment";
import { ListExperimentsUseCase } from "../application/use-cases/list-experiments/list-experiments";
import { UpdateExperimentUseCase } from "../application/use-cases/update-experiment/update-experiment";
import { handleApiError } from "../utils/error-handling";

@Controller()
export class ExperimentController {
  private readonly logger = new Logger(ExperimentController.name);

  constructor(
    private readonly createExperimentUseCase: CreateExperimentUseCase,
    private readonly getExperimentUseCase: GetExperimentUseCase,
    private readonly listExperimentsUseCase: ListExperimentsUseCase,
    private readonly updateExperimentUseCase: UpdateExperimentUseCase,
    private readonly deleteExperimentUseCase: DeleteExperimentUseCase,
    private readonly changeExperimentStatusUseCase: ChangeExperimentStatusUseCase,
  ) {}

  @TsRestHandler(contract.createExperiment)
  async createExperiment() {
    return tsRestHandler(contract.createExperiment, async ({ body, query }) => {
      try {
        const userId = query.userId || "default-user-id";
        const result = await this.createExperimentUseCase.execute(body, userId);

        this.logger.log(`Experiment created: ${result.id} by user ${userId}`);
        return {
          status: StatusCodes.CREATED,
          body: result,
        };
      } catch (error) {
        return handleApiError(error, this.logger);
      }
    });
  }

  @TsRestHandler(contract.getExperiment)
  async getExperiment() {
    return tsRestHandler(contract.getExperiment, async ({ params, query }) => {
      try {
        const userId = query.userId || "default-user-id";
        const experiment = await this.getExperimentUseCase.execute(params.id);

        if (!experiment) {
          return {
            status: StatusCodes.NOT_FOUND,
            body: { message: `Experiment with ID ${params.id} not found` },
          };
        }

        return {
          status: StatusCodes.OK,
          body: experiment,
        };
      } catch (error) {
        return handleApiError(error, this.logger);
      }
    });
  }

  @TsRestHandler(contract.listExperiments)
  async listExperiments() {
    return tsRestHandler(contract.listExperiments, async ({ query }) => {
      try {
        const userId = query.userId || "default-user-id";
        const experiments = await this.listExperimentsUseCase.execute(
          userId,
          query.filter,
        );

        return {
          status: StatusCodes.OK,
          body: experiments,
        };
      } catch (error) {
        return handleApiError(error, this.logger);
      }
    });
  }

  @TsRestHandler(contract.updateExperiment)
  async updateExperiment() {
    return tsRestHandler(
      contract.updateExperiment,
      async ({ params, body, query }) => {
        try {
          const userId = query.userId || "default-user-id";
          const updatedExperiment = await this.updateExperimentUseCase.execute(
            params.id,
            body,
          );

          this.logger.log(`Experiment ${params.id} updated by user ${userId}`);
          return {
            status: StatusCodes.OK,
            body: updatedExperiment,
          };
        } catch (error) {
          return handleApiError(error, this.logger);
        }
      },
    );
  }

  @TsRestHandler(contract.deleteExperiment)
  async deleteExperiment() {
    return tsRestHandler(
      contract.deleteExperiment,
      async ({ params, query }) => {
        try {
          await this.deleteExperimentUseCase.execute(params.id);

          this.logger.log(`Experiment ${params.id} deleted`);
          return {
            status: StatusCodes.NO_CONTENT,
            body: null,
          };
        } catch (error) {
          return handleApiError(error, this.logger);
        }
      },
    );
  }
}
