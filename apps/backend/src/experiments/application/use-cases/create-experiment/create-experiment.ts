import { Injectable } from "@nestjs/common";

import {
  CreateExperimentDto,
  ExperimentDto,
} from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { Result, success, failure, AppError } from "../../../utils/fp-utils";

@Injectable()
export class CreateExperimentUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

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

    // Create the experiment
    const experimentResult = await this.experimentRepository.create(
      data,
      userId,
    );

    return experimentResult.chain((experiments) => {
      if (experiments.length === 0) {
        return failure(AppError.internal("Failed to create experiment"));
      }
      return success(experiments[0]);
    });
  }
}
