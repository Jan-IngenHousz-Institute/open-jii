import { Injectable, Logger } from "@nestjs/common";

import { DeleteExperimentDataComments } from "@repo/api";

import { Result, tryCatch } from "../../../../common/utils/fp-utils";

@Injectable()
export class DeleteExperimentDataCommentsUseCase {
  private readonly logger = new Logger(DeleteExperimentDataCommentsUseCase.name);

  async execute(
    experimentId: string,
    tableName: string,
    userId: string,
    comments: DeleteExperimentDataComments,
  ): Promise<Result<void>> {
    this.logger.log(
      `Deleting experiment data comments for experiment ${experimentId} table ${tableName}`,
      userId,
      comments,
    );

    return await tryCatch(() => {
      return;
    });
  }
}
