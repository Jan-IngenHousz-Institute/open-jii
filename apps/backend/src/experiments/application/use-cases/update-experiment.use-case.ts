import { Injectable, NotFoundException } from "@nestjs/common";

import { ExperimentRepository } from "../../core/repositories/experiment.repository";
import { UpdateExperimentDto } from "../../core/schemas/experiment.schema";

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
