import { Injectable } from "@nestjs/common";

import { CreateExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class CreateExperimentUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(
    data: CreateExperimentDto,
    userId: string,
  ): Promise<{ id: string }> {
    // Validate that the user ID is provided
    if (!userId) {
      throw new Error("User ID is required to create an experiment");
    }

    // Validate that name is provided
    if (!data.name || data.name.trim() === "") {
      throw new Error("Experiment name is required");
    }

    // Create the experiment
    const id = await this.experimentRepository.create(data, userId);

    return { id };
  }
}
