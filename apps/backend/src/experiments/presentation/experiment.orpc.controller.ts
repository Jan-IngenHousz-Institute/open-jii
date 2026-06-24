import { Controller, Inject, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { FEATURE_FLAGS } from "@repo/analytics";
import { experimentCoreOrpcContract } from "@repo/api/domains/experiment/experiment-core.orpc";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { AppError } from "../../common/utils/fp-utils";
import { throwOrpcError, throwOrpcFailure } from "../../common/utils/orpc-fp";
import { CreateExperimentUseCase } from "../application/use-cases/create-experiment/create-experiment";
import { DeleteExperimentUseCase } from "../application/use-cases/delete-experiment/delete-experiment";
import { GetExperimentAccessUseCase } from "../application/use-cases/get-experiment-access/get-experiment-access";
import { GetExperimentUseCase } from "../application/use-cases/get-experiment/get-experiment";
import { ListExperimentsUseCase } from "../application/use-cases/list-experiments/list-experiments";
import { UpdateExperimentUseCase } from "../application/use-cases/update-experiment/update-experiment";
import { ANALYTICS_PORT } from "../core/ports/analytics.port";
import type { AnalyticsPort } from "../core/ports/analytics.port";

@Controller()
export class ExperimentOrpcController {
  private readonly logger = new Logger(ExperimentOrpcController.name);

  constructor(
    @Inject(ANALYTICS_PORT)
    private readonly analyticsPort: AnalyticsPort,
    private readonly createExperimentUseCase: CreateExperimentUseCase,
    private readonly getExperimentUseCase: GetExperimentUseCase,
    private readonly getExperimentAccessUseCase: GetExperimentAccessUseCase,
    private readonly listExperimentsUseCase: ListExperimentsUseCase,
    private readonly updateExperimentUseCase: UpdateExperimentUseCase,
    private readonly deleteExperimentUseCase: DeleteExperimentUseCase,
  ) {}

  @Implement(experimentCoreOrpcContract.createExperiment)
  createExperiment(@Session() session: UserSession) {
    return implement(experimentCoreOrpcContract.createExperiment).handler(async ({ input }) => {
      const transformedBody = {
        ...input,
        embargoUntil: input.embargoUntil ? new Date(input.embargoUntil) : undefined,
      };
      const result = await this.createExperimentUseCase.execute(transformedBody, session.user.id);
      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentCoreOrpcContract.listExperiments)
  listExperiments(@Session() session: UserSession) {
    return implement(experimentCoreOrpcContract.listExperiments).handler(async ({ input }) => {
      const result = await this.listExperimentsUseCase.execute(
        session.user.id,
        input.filter,
        input.status,
        input.search,
      );
      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentCoreOrpcContract.getExperiment)
  getExperiment(@Session() session: UserSession) {
    return implement(experimentCoreOrpcContract.getExperiment).handler(async ({ input }) => {
      const result = await this.getExperimentUseCase.execute(input.id, session.user.id);
      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentCoreOrpcContract.getExperimentAccess)
  getExperimentAccess(@Session() session: UserSession) {
    return implement(experimentCoreOrpcContract.getExperimentAccess).handler(async ({ input }) => {
      const result = await this.getExperimentAccessUseCase.execute(input.id, session.user.id);
      if (result.isSuccess()) {
        return {
          ...result.value,
          experiment: formatDates(result.value.experiment),
        };
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentCoreOrpcContract.updateExperiment)
  updateExperiment(@Session() session: UserSession) {
    return implement(experimentCoreOrpcContract.updateExperiment).handler(async ({ input }) => {
      const { id, ...body } = input;
      const transformedBody = {
        ...body,
        embargoUntil: body.embargoUntil ? new Date(body.embargoUntil) : undefined,
      };
      const result = await this.updateExperimentUseCase.execute(
        id,
        transformedBody,
        session.user.id,
      );
      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(experimentCoreOrpcContract.deleteExperiment)
  deleteExperiment(@Session() session: UserSession) {
    return implement(experimentCoreOrpcContract.deleteExperiment).handler(async ({ input }) => {
      const isDeletionEnabled = await this.analyticsPort.isFeatureFlagEnabled(
        FEATURE_FLAGS.EXPERIMENT_DELETION,
        session.user.email || session.user.id,
      );

      if (!isDeletionEnabled) {
        return throwOrpcError(
          AppError.forbidden("Experiment deletion is currently disabled"),
          this.logger,
          "deleteExperiment",
        );
      }

      const result = await this.deleteExperimentUseCase.execute(input.id, session.user.id);
      if (result.isSuccess()) {
        return undefined;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }
}
