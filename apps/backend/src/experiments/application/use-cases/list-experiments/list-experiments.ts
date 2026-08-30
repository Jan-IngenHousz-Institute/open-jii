import { Injectable, Logger } from "@nestjs/common";

import { ExperimentStatus } from "@repo/api/domains/experiment/experiment.schema";
import type { ResourceSeries } from "@repo/api/domains/metrics/metrics.schema";
import type { ResourceScope } from "@repo/api/shared/listing";

import { AppError, Result, success } from "../../../../common/utils/fp-utils";
import { ResourceMetricsService } from "../../../../metrics/application/resource-metrics.service";
import { ExperimentDto } from "../../../core/models/experiment.model";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

/** A listed resource plus the measurement series its row draws. */
type ExperimentWithActivity = ExperimentDto & { activity: ResourceSeries | null };

@Injectable()
export class ListExperimentsUseCase {
  private readonly logger = new Logger(ListExperimentsUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly resourceMetrics: ResourceMetricsService,
  ) {}

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
  ): Promise<Result<{ items: ExperimentWithActivity[]; totalCount: number }>> {
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

    const paged = await this.experimentRepository.findPage(
      userId,
      page,
      pageSize,
      scope,
      status,
      search,
    );
    if (paged.isFailure()) {
      return paged;
    }

    // The page has already passed the access check, so the series are read
    // for exactly these rows rather than for the whole workspace.
    const series = await this.resourceMetrics.seriesFor(
      "experiment",
      paged.value.items.map((item) => item.id),
    );

    return success({
      items: paged.value.items.map((item) => ({
        ...item,
        activity: series.get(item.id) ?? null,
      })),
      totalCount: paged.value.totalCount,
    });
  }
}
