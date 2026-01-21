import { Controller, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";

import { AddAnnotationsBulkBody, contract } from "@repo/api";

import { handleFailure } from "../../common/utils/fp-utils";
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

  @TsRestHandler(contract.experiments.addAnnotation)
  addAnnotation(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.addAnnotation, async ({ params, body }) => {
      const { id: experimentId } = params;

      this.logger.log(`Adding annotation to experiment ${experimentId} by user ${session.user.id}`);

      const addBody: AddAnnotationsBulkBody = {
        tableName: body.tableName,
        annotation: body.annotation,
        rowIds: [body.rowId],
      };
      const result = await this.addAnnotationsUseCase.execute(
        experimentId,
        addBody,
        session.user.id,
      );

      if (result.isSuccess()) {
        return {
          status: 201,
          body: result.value,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.addAnnotationsBulk)
  addAnnotationsBulk(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.addAnnotationsBulk, async ({ params, body }) => {
      const { id: experimentId } = params;

      this.logger.log(`Adding ${body.rowIds.length} annotations to experiment ${experimentId}`);

      const result = await this.addAnnotationsUseCase.execute(experimentId, body, session.user.id);

      if (result.isSuccess()) {
        return {
          status: 201,
          body: result.value,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.updateAnnotation)
  updateAnnotation(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.updateAnnotation, async ({ params, body }) => {
      const { id: experimentId, annotationId } = params;

      this.logger.log(
        `Updating annotation ${annotationId} for experiment ${experimentId} (user ${session.user.id})`,
      );

      const result = await this.updateAnnotationUseCase.execute(
        experimentId,
        annotationId,
        body,
        session.user.id,
      );

      if (result.isSuccess()) {
        return {
          status: 200,
          body: result.value,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.deleteAnnotation)
  deleteAnnotation(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.deleteAnnotation, async ({ params }) => {
      const { id: experimentId, annotationId } = params;

      this.logger.log(
        `Deleting annotation ${annotationId} from experiment ${experimentId} (user ${session.user.id})`,
      );

      const result = await this.deleteAnnotationsUseCase.execute(
        experimentId,
        { annotationId },
        session.user.id,
      );

      if (result.isSuccess()) {
        return {
          status: 200,
          body: result.value,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.deleteAnnotationsBulk)
  deleteAnnotationBulk(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.deleteAnnotationsBulk, async ({ params, body }) => {
      const { id: experimentId } = params;
      const { tableName, rowIds, type } = body;

      this.logger.log(
        `Deleting all annotations for ${rowIds.length} row(s) of type ${type} from experiment ${experimentId} and table ${tableName} (user ${session.user.id})`,
      );

      const result = await this.deleteAnnotationsUseCase.execute(
        experimentId,
        { tableName, rowIds, type },
        session.user.id,
      );

      if (result.isSuccess()) {
        return {
          status: 200,
          body: result.value,
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
