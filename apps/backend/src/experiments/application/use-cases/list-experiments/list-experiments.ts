import { Injectable } from "@nestjs/common";

import { ExperimentFilter } from "@repo/api";

import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";
import { Result } from "../../../utils/fp-utils";

@Injectable()
export class ListExperimentsUseCase {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(
    userId: string,
    filter?: ExperimentFilter,
  ): Promise<Result<Partial<ExperimentDto>[]>> {
    return await this.experimentRepository.findAll(userId, filter);
  }
}
