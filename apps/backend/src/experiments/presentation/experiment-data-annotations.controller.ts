import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";

import { contract } from "@repo/api";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { handleFailure, tryCatch } from "../../common/utils/fp-utils";
import { AddAnnotationUseCase } from "../application/use-cases/experiment-data-annotations/add-annotation/add-annotation";

// import { DeleteAnnotationUseCase } from "../application/use-cases/experiment-data-annotations/delete-annotation/delete-annotation";
// import { ListAnnotationsUseCase } from "../application/use-cases/experiment-data-annotations/list-annotations/list-annotations";
// import { UpdateAnnotationUseCase } from "../application/use-cases/experiment-data-annotations/update-annotation/update-annotation";

@Controller()
@UseGuards(AuthGuard)
export class ExperimentDataAnnotationsController {
  private readonly logger = new Logger(ExperimentDataAnnotationsController.name);

  constructor(
    private readonly addAnnotationUseCase: AddAnnotationUseCase,
    // private readonly listAnnotationsUseCase: ListAnnotationsUseCase,
    // private readonly updateAnnotationUseCase: UpdateAnnotationUseCase,
    // private readonly deleteAnnotationUseCase: DeleteAnnotationUseCase,
  ) {}

  @TsRestHandler(contract.experiments.addAnnotation)
  addAnnotation(@CurrentUser() user: { id: string }) {
    return tsRestHandler(contract.experiments.addAnnotation, async ({ params, body }) => {
      const { id: experimentId } = params;

      this.logger.log(`Adding annotation to experiment ${experimentId} by user ${user.id}`);

      const result = await this.addAnnotationUseCase.execute(experimentId, user.id, body);

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
  addAnnotationsBulk(@CurrentUser() user: { id: string }) {
    return tsRestHandler(contract.experiments.addAnnotationsBulk, async ({ params, body }) => {
      const { id: experimentId } = params;

      this.logger.log(`Adding ${body.rowIds.length} annotations to experiment ${experimentId}`);

      const result = await this.addAnnotationUseCase.executeMany(experimentId, user.id, body);

      if (result.isSuccess()) {
        return {
          status: 201,
          body: result.value,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.deleteAnnotation)
  deleteAnnotation(@CurrentUser() user: { id: string }) {
    return tsRestHandler(contract.experiments.deleteAnnotation, async ({ params }) => {
      const { id: experimentId, annotationId } = params;

      this.logger.log(
        `Deleting annotation ${annotationId} from experiment ${experimentId} (user ${user.id})`,
      );

      // Dummy code
      await tryCatch(() => {
        return;
      });

      return {
        status: 204,
        body: null,
      };
    });
  }

  @TsRestHandler(contract.experiments.deleteAnnotationsBulk)
  deleteAnnotationBulk(@CurrentUser() user: { id: string }) {
    return tsRestHandler(contract.experiments.deleteAnnotationsBulk, async ({ params }) => {
      const { id: experimentId, tableName, type } = params;

      this.logger.log(
        `Deleting all annotations of type ${type} from experiment ${experimentId} and table ${tableName} (user ${user.id})`,
      );

      // Dummy code
      await tryCatch(() => {
        return;
      });

      return {
        status: 204,
        body: null,
      };
    });
  }
  //
  //   @TsRestHandler(contract.experiments.listAnnotations)
  //   listAnnotations(@CurrentUser() user: { id: string }) {
  //     return tsRestHandler(contract.experiments.listAnnotations, async ({ params, query }) => {
  //       const { id: experimentId } = params;
  //
  //       const result = await this.listAnnotationsUseCase.execute(experimentId, user.id, query);
  //
  //       if (result.isSuccess()) {
  //         return {
  //           status: 200,
  //           body: { annotations: result.value },
  //         };
  //       }
  //
  //       return handleFailure(result);
  //     });
  //   }
  // }
}
