import { Controller, Inject, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { FEATURE_FLAGS } from "@repo/analytics";
import { contract } from "@repo/api";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
import { CreateExperimentUseCase } from "../application/use-cases/create-experiment/create-experiment";
import { DeleteExperimentUseCase } from "../application/use-cases/delete-experiment/delete-experiment";
import { GetExperimentAccessUseCase } from "../application/use-cases/get-experiment-access/get-experiment-access";
import { GetExperimentUseCase } from "../application/use-cases/get-experiment/get-experiment";
import { ListExperimentsUseCase } from "../application/use-cases/list-experiments/list-experiments";
import { UpdateExperimentUseCase } from "../application/use-cases/update-experiment/update-experiment";
import { ANALYTICS_PORT } from "../core/ports/analytics.port";
import type { AnalyticsPort } from "../core/ports/analytics.port";

@Controller()
export class ExperimentController {
  private readonly logger = new Logger(ExperimentController.name);

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

  @TsRestHandler(contract.experiments.createExperiment)
  createExperiment(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.createExperiment, async ({ body }) => {
      // Convert embargoUntil from ISO string to Date object
      const transformedBody = {
        ...body,
        embargoUntil: body.embargoUntil ? new Date(body.embargoUntil) : undefined,
      };

      const result = await this.createExperimentUseCase.execute(transformedBody, session.user.id);

      if (result.isSuccess()) {
        const experiment = result.value;

        this.logger.log(`Experiment created: ${experiment.id} by user ${session.user.id}`);
        return {
          status: StatusCodes.CREATED,
          body: experiment,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.getExperiment)
  getExperiment(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.getExperiment, async ({ params }) => {
      const result = await this.getExperimentUseCase.execute(params.id, session.user.id);

      if (result.isSuccess()) {
        const experiment = result.value;

        // Format dates to strings for the API contract
        const formattedExperiment = formatDates(experiment);

        this.logger.log(`Experiment ${params.id} retrieved`);
        return {
          status: StatusCodes.OK,
          body: formattedExperiment,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.getExperimentAccess)
  getExperimentAccess(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.getExperimentAccess, async ({ params }) => {
      const result = await this.getExperimentAccessUseCase.execute(params.id, session.user.id);

      if (result.isSuccess()) {
        const accessInfo = result.value;

        // Format dates to strings for the API contract
        const formattedAccessInfo = {
          ...accessInfo,
          experiment: formatDates(accessInfo.experiment),
        };

        this.logger.log(
          `Experiment access info for ${params.id} retrieved for user ${session.user.id}`,
        );
        return {
          status: StatusCodes.OK,
          body: formattedAccessInfo,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.listExperiments)
  listExperiments(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.listExperiments, async ({ query }) => {
      const result = await this.listExperimentsUseCase.execute(
        session.user.id,
        query.filter,
        query.status,
        query.search,
      );

      if (result.isSuccess()) {
        const experiments = result.value;

        // Format dates to strings for the API contract
        const formattedExperiments = formatDatesList(experiments);

        this.logger.log(
          `Listed experiments for user ${session.user.id} with filter: ${JSON.stringify(
            query.filter,
          )}, status: ${query.status}, search: ${query.search}`,
        );
        return {
          status: StatusCodes.OK,
          body: formattedExperiments,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.updateExperiment)
  updateExperiment(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.updateExperiment, async ({ params, body }) => {
      // Convert embargoUntil from ISO string to Date object
      const transformedBody = {
        ...body,
        embargoUntil: body.embargoUntil ? new Date(body.embargoUntil) : undefined,
      };

      const result = await this.updateExperimentUseCase.execute(
        params.id,
        transformedBody,
        session.user.id,
      );

      if (result.isSuccess()) {
        const experiment = result.value;

        // Format dates to strings for the API contract
        const formattedExperiment = formatDates(experiment);

        this.logger.log(`Experiment ${params.id} updated by user ${session.user.id}`);
        return {
          status: StatusCodes.OK,
          body: formattedExperiment,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.deleteExperiment)
  deleteExperiment(@Session() session: UserSession) {
    return tsRestHandler(contract.experiments.deleteExperiment, async ({ params }) => {
      const isDeletionEnabled = await this.analyticsPort.isFeatureFlagEnabled(
        FEATURE_FLAGS.EXPERIMENT_DELETION,
        session.user.email || session.user.id,
      );

      if (!isDeletionEnabled) {
        return {
          status: StatusCodes.FORBIDDEN,
          body: { message: "Experiment deletion is currently disabled" },
        };
      }

      const result = await this.deleteExperimentUseCase.execute(params.id, session.user.id);

      if (result.isSuccess()) {
        this.logger.log(`Experiment ${params.id} deleted`);
        return {
          status: StatusCodes.NO_CONTENT,
          body: null,
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
