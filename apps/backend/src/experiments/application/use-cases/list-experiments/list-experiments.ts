import { Injectable, Logger } from "@nestjs/common";

import { ExperimentStatus } from "@repo/api/domains/experiment/experiment.schema";
import type { ResourceScope } from "@repo/api/shared/listing";

import { AppError, Result } from "../../../../common/utils/fp-utils";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

@Injectable()
export class ListExperimentsUseCase {
  private readonly logger = new Logger(ListExperimentsUseCase.name);

  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async execute(
    userId: string,
    scope?: ResourceScope,
    status?: ExperimentStatus,
    search?: string,
  ): Promise<Result<ExperimentDto[]>> {
    this.logger.log({
      msg: "Listing experiments",
      operation: "list",
      userId,
      scope,
      status,
      search,
    });

    const result = await this.experimentRepository.findAll(userId, scope, status, search);

    result.fold(
      (experiments: ExperimentDto[]) => {
        this.logger.debug({
          msg: "Found experiments",
          operation: "list",
          userId,
          count: experiments.length,
        });
      },
      (error: AppError) => {
        this.logger.error({
          msg: "Failed to list experiments",
          errorCode: error.code,
          operation: "list",
          userId,
          error,
        });
      },
    );

    return result;
  }

  async executePaginated(
    userId: string,
    page: number,
    pageSize: number,
    scope?: ResourceScope,
    status?: ExperimentStatus,
    search?: string,
  ): Promise<Result<{ items: ExperimentDto[]; totalCount: number }>> {
    this.logger.log({
      msg: "Listing experiments",
      operation: "listPaginated",
      userId,
      page,
      pageSize,
      scope,
      status,
      search,
    });

    return this.experimentRepository.findPage(userId, page, pageSize, scope, status, search);
  }
}
