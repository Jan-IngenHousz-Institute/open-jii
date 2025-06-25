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
  ): Promise<Result<ExperimentDto[]>> {
    this.logger.log(
      `Listing experiments for user ${userId}${filter ? ` with filter "${filter}"` : ""}${status ? ` and status "${status}"` : ""}`,
    );

    const result = await this.experimentRepository.findAll(userId, filter, status);

    result.fold(
      (experiments: ExperimentDto[]) => {
        this.logger.debug(`Found ${experiments.length} experiments for user ${userId}`);
      },
      (error: AppError) => {
        this.logger.error(`Failed to list experiments for user ${userId}: ${error.message}`);
      },
    );

    return result;
  }
}
