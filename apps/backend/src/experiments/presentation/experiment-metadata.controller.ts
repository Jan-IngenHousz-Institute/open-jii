import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { experimentMetadataContract } from "@repo/api/domains/experiment/experiment-metadata.contract";

import { formatDates } from "../../common/utils/date-formatter";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
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

  @Implement(experimentMetadataContract.listExperimentMetadata)
  listExperimentMetadata(@Session() session: UserSession) {
    return implement(experimentMetadataContract.listExperimentMetadata).handler(
      async ({ input }) => {
        const result = await this.getExperimentMetadataUseCase.execute(input.id, session.user.id);
        if (result.isSuccess()) {
          return result.value.map(formatDates);
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  @Implement(experimentMetadataContract.createExperimentMetadata)
  createExperimentMetadata(@Session() session: UserSession) {
    return implement(experimentMetadataContract.createExperimentMetadata).handler(
      async ({ input }) => {
        const { id, ...body } = input;
        const result = await this.createExperimentMetadataUseCase.execute(
          id,
          body,
          session.user.id,
        );
        if (result.isSuccess()) {
          return formatDates(result.value);
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  @Implement(experimentMetadataContract.updateExperimentMetadata)
  updateExperimentMetadata(@Session() session: UserSession) {
    return implement(experimentMetadataContract.updateExperimentMetadata).handler(
      async ({ input }) => {
        const { id, metadataId, ...body } = input;
        const result = await this.updateExperimentMetadataUseCase.execute(
          id,
          metadataId,
          body,
          session.user.id,
        );
        if (result.isSuccess()) {
          return formatDates(result.value);
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }

  @Implement(experimentMetadataContract.deleteExperimentMetadata)
  deleteExperimentMetadata(@Session() session: UserSession) {
    return implement(experimentMetadataContract.deleteExperimentMetadata).handler(
      async ({ input }) => {
        const result = await this.deleteExperimentMetadataUseCase.execute(
          input.id,
          input.metadataId,
          session.user.id,
        );
        if (result.isSuccess()) {
          return undefined;
        }
        return throwOrpcFailure(result, this.logger);
      },
    );
  }
}
