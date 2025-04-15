import { Injectable, NotFoundException } from "@nestjs/common";

import { ExperimentRepository } from "../../core/repositories/experiment.repository";

@Injectable()
export class GetExperimentUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(id: string) {
    const experiment = await this.experimentRepository.findOne(id);
    if (!experiment) {
      throw new NotFoundException(`Experiment with ID ${id} not found`);
    }
    return experiment;
  }
}
