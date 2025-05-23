import { Injectable } from "@nestjs/common";

import {
  CreateExperimentDto,
  ExperimentDto,
} from "../../../core/models/experiment.model";
import { ExperimentMemberRepository } from "../../../core/repositories/experiment-member.repository";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { Result, success, failure, AppError } from "../../../utils/fp-utils";

@Injectable()
export class CreateExperimentUseCase {
  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly experimentMemberRepository: ExperimentMemberRepository,
  ) {}

  async execute(
    data: CreateExperimentDto,
    userId: string,
  ): Promise<Result<ExperimentDto>> {
    // Validate that the user ID is provided
    if (!userId) {
      return failure(
        AppError.badRequest("User ID is required to create an experiment"),
      );
    }

    // Validate that name is provided
    if (!data.name || data.name.trim() === "") {
      return failure(AppError.badRequest("Experiment name is required"));
    }

    // Check if an experiment with the same name already exists
    const existingExperimentResult = await this.experimentRepository.findByName(
      data.name,
    );

    return existingExperimentResult.chain(
      async (existingExperiment: ExperimentDto | null) => {
        if (existingExperiment) {
          return failure(
            AppError.badRequest(
              `An experiment with the name "${data.name}" already exists`,
            ),
          );
        }

        // Create the experiment
        const experimentResult = await this.experimentRepository.create(
          data,
          userId,
        );

        return experimentResult.chain(async (experiments: ExperimentDto[]) => {
          if (experiments.length === 0) {
            return failure(AppError.internal("Failed to create experiment"));
          }

          const experiment = experiments[0];

          // Add the user as an admin member
          const addMemberResult =
            await this.experimentMemberRepository.addMember(
              experiment.id,
              userId,
              "admin",
            );

          return addMemberResult.chain(() => {
            return success(experiment);
          });
        });
      },
    );
  }
}
