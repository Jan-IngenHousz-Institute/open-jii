import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { experimentDataAnnotationsContract } from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.contract";
import type { ExperimentAddAnnotationsBulkBody } from "@repo/api/domains/experiment/data-annotations/experiment-data-annotations.schema";

import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { AddAnnotationsUseCase } from "../application/use-cases/experiment-data-annotations/add-annotations/add-annotations";
import { DeleteAnnotationsUseCase } from "../application/use-cases/experiment-data-annotations/delete-annotations/delete-annotations";
import { UpdateAnnotationUseCase } from "../application/use-cases/experiment-data-annotations/update-annotation/update-annotation";

@Controller()
export class ExperimentDataAnnotationsController {
  private readonly logger = new Logger(ExperimentDataAnnotationsController.name);

  constructor(
    private readonly addAnnotationsUseCase: AddAnnotationsUseCase,
    private readonly updateAnnotationUseCase: UpdateAnnotationUseCase,
    private readonly deleteAnnotationsUseCase: DeleteAnnotationsUseCase,
  ) {}

  @Implement(experimentDataAnnotationsContract.addAnnotation)
  addAnnotation(@Session() session: UserSession) {
    return implement(experimentDataAnnotationsContract.addAnnotation).handler(async ({ input }) => {
      const { id, ...body } = input;
      const addBody: ExperimentAddAnnotationsBulkBody = {
        tableName: body.tableName,
        annotation: body.annotation,
        rowIds: [body.rowId],
      };
      const result = await this.addAnnotationsUseCase.execute(id, addBody, session.user.id);
      if (result.isSuccess()) {
        return result.value;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentDataAnnotationsContract.addAnnotationsBulk)
  addAnnotationsBulk(@Session() session: UserSession) {
    return implement(experimentDataAnnotationsContract.addAnnotationsBulk).handler(
      async ({ input }) => {
        const { id, ...body } = input;
        const result = await this.addAnnotationsUseCase.execute(id, body, session.user.id);
        if (result.isSuccess()) {
          return result.value;
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  @Implement(experimentDataAnnotationsContract.updateAnnotation)
  updateAnnotation(@Session() session: UserSession) {
    return implement(experimentDataAnnotationsContract.updateAnnotation).handler(
      async ({ input }) => {
        const { id, annotationId, ...body } = input;
        const result = await this.updateAnnotationUseCase.execute(
          id,
          annotationId,
          body,
          session.user.id,
        );
        if (result.isSuccess()) {
          return result.value;
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  @Implement(experimentDataAnnotationsContract.deleteAnnotation)
  deleteAnnotation(@Session() session: UserSession) {
    return implement(experimentDataAnnotationsContract.deleteAnnotation).handler(
      async ({ input }) => {
        const result = await this.deleteAnnotationsUseCase.execute(
          input.id,
          { annotationId: input.annotationId },
          session.user.id,
        );
        if (result.isSuccess()) {
          return result.value;
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  @Implement(experimentDataAnnotationsContract.deleteAnnotationsBulk)
  deleteAnnotationBulk(@Session() session: UserSession) {
    return implement(experimentDataAnnotationsContract.deleteAnnotationsBulk).handler(
      async ({ input }) => {
        const { id, ...body } = input;
        const result = await this.deleteAnnotationsUseCase.execute(
          id,
          { tableName: body.tableName, rowIds: body.rowIds, type: body.type },
          session.user.id,
        );
        if (result.isSuccess()) {
          return result.value;
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }
}
