import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { User } from "@repo/auth/types";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { handleFailure } from "../../common/utils/fp-utils";
import { CreateExperimentDataCommentsUseCase } from "../application/use-cases/experiment-data-comments/create-experiment-data-comments";
import { DeleteExperimentDataCommentsUseCase } from "../application/use-cases/experiment-data-comments/delete-experiment-data-comments";

@Controller()
@UseGuards(AuthGuard)
export class ExperimentCommentsController {
  private readonly logger = new Logger(ExperimentCommentsController.name);

  constructor(
    private readonly createExperimentDataCommentsUseCase: CreateExperimentDataCommentsUseCase,
    private readonly deleteExperimentDataCommentsUseCase: DeleteExperimentDataCommentsUseCase,
  ) {}

  @TsRestHandler(contract.experiments.createExperimentDataComments)
  createExperimentDataComments(@CurrentUser() user: User) {
    return tsRestHandler(
      contract.experiments.createExperimentDataComments,
      async ({ params, body }) => {
        //this.logger.log("createExperimentDataComment", body);

        const result = await this.createExperimentDataCommentsUseCase.execute(
          params.id,
          params.tableName,
          user.id,
          body,
        );

        if (result.isSuccess()) {
          const comments = result.value;

          this.logger.log(
            `Created ${comments.length} comment(s) for experiment ${params.id} on table ${params.tableName} by user ${user.id}`,
          );
          return {
            status: StatusCodes.CREATED,
            body: comments,
          };
        }

        return handleFailure(result, this.logger);
      },
    );
  }

  @TsRestHandler(contract.experiments.deleteExperimentDataComments)
  deleteExperimentDataComments(@CurrentUser() user: User) {
    return tsRestHandler(
      contract.experiments.deleteExperimentDataComments,
      async ({ params, body }) => {
        //this.logger.log("deleteExperimentDataComments", params, body, user);

        const result = await this.deleteExperimentDataCommentsUseCase.execute(
          params.id,
          params.tableName,
          user.id,
          body,
        );

        if (result.isSuccess()) {
          this.logger.log(
            `Experiment comment(s) for experiment ${params.id} on table ${params.tableName} deleted`,
          );
          return {
            status: StatusCodes.NO_CONTENT,
            body: null,
          };
        }

        return handleFailure(result, this.logger);
      },
    );
  }
}
