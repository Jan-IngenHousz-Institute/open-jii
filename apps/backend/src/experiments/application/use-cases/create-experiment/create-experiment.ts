import { Injectable, Logger, Inject } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { CreateExperimentDto, ExperimentDto } from "../../../core/models/experiment.model";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { LocationRepository } from "../../../core/repositories/experiment-location.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class CreateExperimentUseCase {
  private readonly logger = new Logger(CreateExperimentUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly locationRepository: LocationRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(
    data: CreateExperimentDto,
    userId: string,
    targetOrganizationId?: string | null,
  ): Promise<Result<ExperimentDto>> {
    this.logger.log({
      msg: "Creating experiment",
      operation: "createExperiment",
      userId,
    });

    // Validate that the user ID is provided
    if (!userId) {
      this.logger.warn({
        msg: "Attempt to create experiment without user ID",
        errorCode: ErrorCodes.BAD_REQUEST,
        operation: "createExperiment",
      });
      return failure(AppError.badRequest("User ID is required to create an experiment"));
    }

    // Validate that name is provided
    if (!data.name || data.name.trim() === "") {
      this.logger.warn({
        msg: "Invalid experiment name provided",
        errorCode: ErrorCodes.BAD_REQUEST,
        operation: "createExperiment",
        userId,
      });
      return failure(AppError.badRequest("Experiment name is required"));
    }

    // Check if an experiment with the same name already exists
    const existingExperimentResult = await this.experimentRepository.findByName(data.name);

    return existingExperimentResult.chain(async (existingExperiment) => {
      if (existingExperiment) {
        this.logger.warn({
          msg: "Attempt to create duplicate experiment",
          errorCode: ErrorCodes.EXPERIMENT_DUPLICATE_NAME,
          operation: "createExperiment",
          userId,
        });
        return failure(
          AppError.badRequest(`An experiment with the name "${data.name}" already exists`),
        );
      }

      this.logger.debug({
        msg: "Creating experiment in repository",
        operation: "createExperiment",
        userId,
      });

      // Anyone picked in the create form gets the read-and-contribute tier: they
      // can open the experiment and add data to it, which is what being listed as
      // a collaborator at creation time has always meant. The creator is filtered
      // out — full control already follows from their role in the owning org, and
      // a grant can only raise access, never lower it.
      //
      // Seeded by `create` itself, inside the same transaction as the experiment:
      // an unselectable grantee refuses the create outright (400) rather than
      // leaving an experiment behind with some of its collaborators attached.
      const invitedCollaborators = (Array.isArray(data.members) ? data.members : [])
        .filter((member) => member.userId !== userId)
        .map((member) => member.userId);

      // Create the experiment
      const experimentResult = await this.experimentRepository.create(
        data,
        userId,
        targetOrganizationId,
        invitedCollaborators,
      );

      return experimentResult.chain(async (experiments: ExperimentDto[]) => {
        if (experiments.length === 0) {
          this.logger.error({
            msg: "Failed to create experiment in repository",
            errorCode: ErrorCodes.EXPERIMENT_CREATE_FAILED,
            operation: "createExperiment",
            userId,
          });
          return failure(AppError.internal("Failed to create experiment"));
        }

        const experiment = experiments[0];

        // Associate locations if provided
        if (Array.isArray(data.locations) && data.locations.length > 0) {
          const locationsWithExperimentId = data.locations.map((location) => ({
            ...location,
            experimentId: experiment.id,
          }));

          const addLocationsResult =
            await this.locationRepository.createMany(locationsWithExperimentId);
          if (addLocationsResult.isFailure()) {
            this.logger.error({
              msg: "Failed to associate locations with experiment",
              errorCode: ErrorCodes.EXPERIMENT_CREATE_FAILED,
              operation: "createExperiment",
              experimentId: experiment.id,
              error: addLocationsResult.error,
            });
            return failure(
              AppError.badRequest(
                `Failed to associate locations: ${addLocationsResult.error.message}`,
              ),
            );
          }
        }

        this.logger.log({
          msg: "Experiment created successfully",
          operation: "createExperiment",
          experimentId: experiment.id,
          userId,
          status: "success",
        });
        return success(experiment);
      });
    });
  }
}
