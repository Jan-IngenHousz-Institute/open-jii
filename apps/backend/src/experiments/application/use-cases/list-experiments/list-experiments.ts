import { Injectable, Logger } from "@nestjs/common";

import { ExperimentFilter, ExperimentStatus } from "@repo/api";

import { AppError, Result } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class ListExperimentsUseCase {
  private readonly logger = new Logger(ListExperimentsUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(
    userId: string,
    filter?: ExperimentFilter,
    status?: ExperimentStatus,
    search?: string,
  ): Promise<Result<ExperimentDto[]>> {
    this.logger.log({
      msg: "Listing experiments",
      operation: "list",
      context: ListExperimentsUseCase.name,
      userId,
      filter,
      status,
      search,
    });

    const result = await this.experimentRepository.findAll(userId, filter, status, search);

    result.fold(
      (experiments: ExperimentDto[]) => {
        this.logger.debug({
          msg: "Found experiments",
          operation: "list",
          context: ListExperimentsUseCase.name,
          userId,
          count: experiments.length,
        });
      },
      (error: AppError) => {
        this.logger.error({
          msg: "Failed to list experiments",
          errorCode: error.code,
          operation: "list",
          context: ListExperimentsUseCase.name,
          userId,
          error,
        });
      },
    );

    return result;
  }
}
