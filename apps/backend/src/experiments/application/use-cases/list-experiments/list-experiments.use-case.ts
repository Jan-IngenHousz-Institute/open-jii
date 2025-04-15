import { Injectable } from "@nestjs/common";

import { ExperimentRepository } from "../../core/repositories/experiment.repository";
import type { ExperimentFilter } from "../pipes/experiment-filter.pipe";

@Injectable()
export class ListExperimentsUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(userId: string, filter?: ExperimentFilter) {
    return this.experimentRepository.findAll(userId, filter);
  }
}
