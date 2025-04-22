import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class DeleteExperimentUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(id: string): Promise<void> {
    // Check if experiment exists
    const experiment = await this.experimentRepository.findOne(id);
    if (!experiment) {
      throw new NotFoundException(`Experiment with ID ${id} not found`);
    }

    // Delete the experiment
    await this.experimentRepository.delete(id);
  }
}
