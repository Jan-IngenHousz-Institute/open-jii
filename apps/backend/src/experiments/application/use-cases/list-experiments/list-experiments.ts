import { Injectable } from "@nestjs/common";

import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { ExperimentFilter } from "../../pipes/experiment-filter.pipe";

@Injectable()
export class ListExperimentsUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(userId: string, filter?: ExperimentFilter): Promise<any[]> {
    return await this.experimentRepository.findAll(userId, filter);
  }
}
