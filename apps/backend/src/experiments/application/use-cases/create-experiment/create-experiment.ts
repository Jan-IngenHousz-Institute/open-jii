import { Injectable, Logger, Inject } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { CreateExperimentDto, ExperimentDto } from "../../../core/models/experiment.model";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { LocationRepository } from "../../../core/repositories/experiment-location.repository";
import { ExperimentMemberRepository } from "../../../core/repositories/experiment-member.repository";
import { ExperimentProtocolRepository } from "../../../core/repositories/experiment-protocol.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class CreateExperimentUseCase {
  private readonly logger = new Logger(CreateExperimentUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentMemberRepository: ExperimentMemberRepository,
    private readonly experimentProtocolRepository: ExperimentProtocolRepository,
    private readonly locationRepository: LocationRepository,
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(data: CreateExperimentDto, userId: string): Promise<Result<ExperimentDto>> {
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
      // Create the experiment
      const experimentResult = await this.experimentRepository.create(data, userId);

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
        this.logger.debug({
          msg: "Adding admin member to experiment",
          operation: "createExperiment",
          experimentId: experiment.id,
          userId,
        });

        // Filter out any member with the same userId as the admin
        const filteredMembers = (Array.isArray(data.members) ? data.members : []).filter(
          (member) => member.userId !== userId,
        );

        // Add the user as an admin member + the rest of the members if provided
        const allMembers = [{ userId, role: "admin" as const }, ...filteredMembers];

        const addMembersResult = await this.experimentMemberRepository.addMembers(
          experiment.id,
          allMembers,
        );

        return addMembersResult.chain(async () => {
          // Associate protocols if provided
          if (Array.isArray(data.protocols) && data.protocols.length > 0) {
            const addProtocolsResult = await this.experimentProtocolRepository.addProtocols(
              experiment.id,
              data.protocols,
            );
            if (addProtocolsResult.isFailure()) {
              this.logger.error({
                msg: "Failed to associate protocols with experiment",
                errorCode: ErrorCodes.EXPERIMENT_CREATE_FAILED,
                operation: "createExperiment",
                experimentId: experiment.id,
                error: addProtocolsResult.error,
              });
              return failure(
                AppError.badRequest(
                  `Failed to associate protocols: ${addProtocolsResult.error.message}`,
                ),
              );
            }
          }

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

          // Experiment provisioning removed - with centrum consolidation, all experiments
          // use the single centrum schema and pipeline automatically

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
    });
  }
}
