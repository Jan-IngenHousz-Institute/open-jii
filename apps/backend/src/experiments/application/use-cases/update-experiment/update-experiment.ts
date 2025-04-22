import { Injectable, NotFoundException } from "@nestjs/common";

import { UpdateExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class UpdateExperimentUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(id: string, data: UpdateExperimentDto): Promise<any> {
    // Check if experiment exists
    const experiment = await this.experimentRepository.findOne(id);

    if (!experiment) {
      throw new NotFoundException(`Experiment with ID ${id} not found`);
    }

    // Update the experiment
    const updatedExperiment = await this.experimentRepository.update(id, data);
    return updatedExperiment;
  }
}
