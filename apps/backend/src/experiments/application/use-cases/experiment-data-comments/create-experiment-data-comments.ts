import { Injectable, Logger } from "@nestjs/common";

import type { CreateExperimentDataComments, ExperimentDataComment } from "@repo/api";

import { Result, tryCatch } from "../../../../common/utils/fp-utils";

@Injectable()
export class CreateExperimentDataCommentsUseCase {
  private readonly logger = new Logger(CreateExperimentDataCommentsUseCase.name);

  async execute(
    experimentId: string,
    tableName: string,
    userId: string,
    newComment: CreateExperimentDataComments,
  ): Promise<Result<ExperimentDataComment[]>> {
    this.logger.log(
      `Creating experiment data comments for experiment ${experimentId} table ${tableName} and comments`,
      userId,
      newComment,
    );

    return await tryCatch(() => {
      return [];
    });
  }
}
