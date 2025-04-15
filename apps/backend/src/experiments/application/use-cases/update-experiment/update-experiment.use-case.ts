import { Injectable, NotFoundException } from "@nestjs/common";

import { UpdateExperimentDto } from "../../core/model/experiment.model";
import { ExperimentRepository } from "../../core/repositories/experiment.repository";

@Injectable()
export class UpdateExperimentUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(id: string, updateExperimentDto: UpdateExperimentDto) {
    const experiment = await this.experimentRepository.findOne(id);
    if (!experiment) {
      throw new NotFoundException(`Experiment with ID ${id} not found`);
    }
    return this.experimentRepository.update(id, updateExperimentDto);
  }
}
