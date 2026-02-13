import { Controller, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { handleFailure } from "../../common/utils/fp-utils";
import { toApiResponse } from "../core/models/experiment-metadata.model";
import { DeleteExperimentMetadataUseCase } from "../application/use-cases/experiment-metadata/delete-experiment-metadata";
import { GetExperimentMetadataUseCase } from "../application/use-cases/experiment-metadata/get-experiment-metadata";
import { UpsertExperimentMetadataUseCase } from "../application/use-cases/experiment-metadata/upsert-experiment-metadata";

@Controller()
export class ExperimentMetadataController {
  private readonly logger = new Logger(ExperimentMetadataController.name);

  constructor(
    private readonly getExperimentMetadataUseCase: GetExperimentMetadataUseCase,
    private readonly upsertExperimentMetadataUseCase: UpsertExperimentMetadataUseCase,
    private readonly deleteExperimentMetadataUseCase: DeleteExperimentMetadataUseCase,
  ) {}

  @TsRestHandler(contract.experiments.getExperimentMetadata)
  getExperimentMetadata(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.getExperimentMetadata, async ({ params }) => {
      const { id: experimentId } = params;

      this.logger.log({
        msg: "Processing get metadata request",
        operation: "getMetadata",
        experimentId,
        userId: session.user.id,
      });

      const result = await this.getExperimentMetadataUseCase.execute(
        experimentId,
        session.user.id
      );

      if (result.isSuccess()) {
        this.logger.log({
          msg: "Successfully retrieved metadata",
          operation: "getMetadata",
          experimentId,
          status: "success",
        });

        return {
          status: StatusCodes.OK as const,
          body: result.value ? toApiResponse(result.value) : null,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.upsertExperimentMetadata)
  upsertExperimentMetadata(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.upsertExperimentMetadata, async ({ params, body }) => {
      const { id: experimentId } = params;

      this.logger.log({
        msg: "Processing upsert metadata request",
        operation: "upsertMetadata",
        experimentId,
        userId: session.user.id,
        columnCount: body.columns?.length ?? 0,
        rowCount: body.rows?.length ?? 0,
      });

      const result = await this.upsertExperimentMetadataUseCase.execute(
        experimentId,
        body,
        session.user.id
      );

      if (result.isSuccess()) {
        this.logger.log({
          msg: "Successfully upserted metadata",
          operation: "upsertMetadata",
          experimentId,
          metadataId: result.value.id,
          status: "success",
        });

        return {
          status: StatusCodes.OK as const,
          body: toApiResponse(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.deleteExperimentMetadata)
  deleteExperimentMetadata(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.deleteExperimentMetadata, async ({ params }) => {
      const { id: experimentId } = params;

      this.logger.log({
        msg: "Processing delete metadata request",
        operation: "deleteMetadata",
        experimentId,
        userId: session.user.id,
      });

      const result = await this.deleteExperimentMetadataUseCase.execute(
        experimentId,
        session.user.id
      );

      if (result.isSuccess()) {
        this.logger.log({
          msg: "Successfully deleted metadata",
          operation: "deleteMetadata",
          experimentId,
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
