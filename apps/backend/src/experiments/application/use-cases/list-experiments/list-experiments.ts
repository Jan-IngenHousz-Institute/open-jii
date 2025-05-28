import { Injectable, Logger } from "@nestjs/common";

import { ExperimentFilter, ExperimentStatus } from "@repo/api";

import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { Result } from "../../../utils/fp-utils";

@Injectable()
export class ListExperimentsUseCase {
  private readonly logger = new Logger(ListExperimentsUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(
    userId: string,
    filter?: ExperimentFilter,
    status?: ExperimentStatus,
  ): Promise<Result<Partial<ExperimentDto>[]>> {
    this.logger.log(
      `Listing experiments for user ${userId}${filter ? ` with filter "${filter}"` : ""}${status ? ` and status "${status}"` : ""}`,
    );

    const result = await this.experimentRepository.findAll(
      userId,
      filter,
      status,
    );

    result.fold(
      (experiments) => {
        this.logger.debug(
          `Found ${experiments.length} experiments for user ${userId}`,
        );
      },
      (error) => {
        this.logger.error(
          `Failed to list experiments for user ${userId}: ${error.message}`,
        );
      },
    );

    return result;
  }
}
