import { Injectable } from "@nestjs/common";

import { CreateExperimentDto } from "src/experiments/core/models/experiment.model";

import { ExperimentRepository } from "../../core/repositories/experiment.repository";

export interface CreateExperimentResponse {
  id: string;
}

@Injectable()
export class CreateExperimentUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(
    createExperimentDto: CreateExperimentDto,
    userId: string,
  ): Promise<CreateExperimentResponse> {
    // Business logic validation could go here
    // For example, check if user has permissions to create experiments
    // or validate experiment-specific business rules

    // Create the experiment using the repository
    const result = await this.experimentRepository.create(
      createExperimentDto,
      userId,
    );

    // Return a response with the experiment ID
    return {
      id: result.id,
    };
  }
}
