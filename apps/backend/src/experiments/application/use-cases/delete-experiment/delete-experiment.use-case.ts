import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";

import { ExperimentRepository } from "../../core/repositories/experiment.repository";

@Injectable()
export class DeleteExperimentUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(id: string, userId: string) {
    // Check if experiment exists
    const experiment = await this.experimentRepository.findOne(id);
    if (!experiment) {
      throw new NotFoundException(`Experiment with ID ${id} not found`);
    }

    // Only creator can delete an experiment
    if (experiment.createdBy !== userId) {
      throw new ForbiddenException(`Only the creator can delete this experiment`);
    }

    // Delete the experiment
    await this.experimentRepository.delete(id);
  }
}