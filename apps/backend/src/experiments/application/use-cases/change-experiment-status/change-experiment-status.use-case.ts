import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";

import { ExperimentRepository } from "../../core/repositories/experiment.repository";

export type ExperimentStatus = "provisioning" | "active" | "archived";

@Injectable()
export class ChangeExperimentStatusUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(id: string, status: ExperimentStatus) {
    const experiment = await this.experimentRepository.findOne(id);
    if (!experiment) {
      throw new NotFoundException(`Experiment with ID ${id} not found`);
    }
    if (!["provisioning", "active", "archived"].includes(status)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }
    // Optionally, add business rules for allowed transitions
    return this.experimentRepository.update(id, { status });
  }
}
