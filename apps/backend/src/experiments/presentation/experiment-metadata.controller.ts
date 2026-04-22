import { Controller, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { formatDates } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
import { CreateExperimentMetadataUseCase } from "../application/use-cases/experiment-metadata/create-experiment-metadata";
import { DeleteExperimentMetadataUseCase } from "../application/use-cases/experiment-metadata/delete-experiment-metadata";
import { GetExperimentMetadataUseCase } from "../application/use-cases/experiment-metadata/get-experiment-metadata";
import { UpdateExperimentMetadataUseCase } from "../application/use-cases/experiment-metadata/update-experiment-metadata";

@Controller()
export class ExperimentMetadataController {
  private readonly logger = new Logger(ExperimentMetadataController.name);

  constructor(
    private readonly getExperimentMetadataUseCase: GetExperimentMetadataUseCase,
    private readonly createExperimentMetadataUseCase: CreateExperimentMetadataUseCase,
    private readonly updateExperimentMetadataUseCase: UpdateExperimentMetadataUseCase,
    private readonly deleteExperimentMetadataUseCase: DeleteExperimentMetadataUseCase,
  ) {}

  @TsRestHandler(contract.experiments.listExperimentMetadata)
  listExperimentMetadata(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.listExperimentMetadata, async ({ params }) => {
      const { id: experimentId } = params;

      this.logger.log({
        msg: "Processing list metadata request",
        operation: "listMetadata",
        experimentId,
        userId: session.user.id,
      });

      const result = await this.getExperimentMetadataUseCase.execute(experimentId, session.user.id);

      if (result.isSuccess()) {
        this.logger.log({
          msg: "Successfully listed metadata",
          operation: "listMetadata",
          experimentId,
          count: result.value.length,
          status: "success",
        });

        return {
          status: StatusCodes.OK as const,
          body: result.value.map(formatDates),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.createExperimentMetadata)
  createExperimentMetadata(@Session() session: UserSession) {
    return tsRestHandler(
      contract.experiments.createExperimentMetadata,
      async ({ params, body }) => {
        const { id: experimentId } = params;

        this.logger.log({
          msg: "Processing create metadata request",
          operation: "createMetadata",
          experimentId,
          userId: session.user.id,
        });

        const result = await this.createExperimentMetadataUseCase.execute(
          experimentId,
          body,
          session.user.id,
        );

        if (result.isSuccess()) {
          this.logger.log({
            msg: "Successfully created metadata",
            operation: "createMetadata",
            experimentId,
            metadataId: result.value.metadataId,
            status: "success",
          });

          return {
            status: StatusCodes.CREATED as const,
            body: formatDates(result.value),
          };
        }

        return handleFailure(result, this.logger);
      },
    );
  }

  @TsRestHandler(contract.experiments.updateExperimentMetadata)
  updateExperimentMetadata(@Session() session: UserSession) {
    return tsRestHandler(
      contract.experiments.updateExperimentMetadata,
      async ({ params, body }) => {
        const { id: experimentId, metadataId } = params;

        this.logger.log({
          msg: "Processing update metadata request",
          operation: "updateMetadata",
          experimentId,
          metadataId,
          userId: session.user.id,
        });

        const result = await this.updateExperimentMetadataUseCase.execute(
          experimentId,
          metadataId,
          body,
          session.user.id,
        );

        if (result.isSuccess()) {
          this.logger.log({
            msg: "Successfully updated metadata",
            operation: "updateMetadata",
            experimentId,
            metadataId,
            status: "success",
          });

          return {
            status: StatusCodes.OK as const,
            body: formatDates(result.value),
          };
        }

        return handleFailure(result, this.logger);
      },
    );
  }

  @TsRestHandler(contract.experiments.deleteExperimentMetadata)
  deleteExperimentMetadata(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.deleteExperimentMetadata, async ({ params }) => {
      const { id: experimentId, metadataId } = params;

      this.logger.log({
        msg: "Processing delete metadata request",
        operation: "deleteMetadata",
        experimentId,
        metadataId,
        userId: session.user.id,
      });

      const result = await this.deleteExperimentMetadataUseCase.execute(
        experimentId,
        metadataId,
        session.user.id,
      );

      if (result.isSuccess()) {
        this.logger.log({
          msg: "Successfully deleted metadata",
          operation: "deleteMetadata",
          experimentId,
          metadataId,
          status: "success",
        });

        return {
          status: StatusCodes.NO_CONTENT as const,
          body: null,
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
