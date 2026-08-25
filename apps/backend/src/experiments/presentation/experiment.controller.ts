import { Controller, Inject, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { FEATURE_FLAGS } from "@repo/analytics";
import { experimentContract } from "@repo/api/domains/experiment/experiment.contract";
import { DEFAULT_PAGE_SIZE, resolveListScope } from "@repo/api/shared/listing";

import { CanAccess } from "../../authorization/can-access.decorator";
import { CanCreateInOrg } from "../../authorization/can-create-in-org.guard";
import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { AppError } from "../../common/utils/fp-utils";
import { throwOrpcError, throwOrpcFailure } from "../../common/utils/orpc-fp";
import { toPage } from "../../common/utils/pagination";
import { SetVisibilityUseCase } from "../../visibility/application/use-cases/set-visibility/set-visibility";
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
    private readonly setVisibilityUseCase: SetVisibilityUseCase,
  ) {}

  @CanCreateInOrg()
  @Implement(experimentContract.createExperiment)
  createExperiment(@Session() session: UserSession) {
    return implement(experimentContract.createExperiment).handler(async ({ input }) => {
      const { organizationId, ...rest } = input;
      const transformedBody = {
        ...rest,
        embargoUntil: rest.embargoUntil ? new Date(rest.embargoUntil) : undefined,
      };

      const result = await this.createExperimentUseCase.execute(
        transformedBody,
        session.user.id,
        organizationId ?? null,
      );

      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  // One listing, two shapes: `page` presence is the only thing that switches it from a
  // bare array to the paged envelope, so a caller that sends no page is untouched.
  @Implement(experimentContract.listExperiments)
  listExperiments(@Session() session: UserSession) {
    return implement(experimentContract.listExperiments).handler(async ({ input }) => {
      const scope = resolveListScope(input);

      if (input.page !== undefined) {
        const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
        const paged = await this.listExperimentsUseCase.executePaginated(
          session.user.id,
          input.page,
          pageSize,
          scope,
          input.status,
          input.search,
        );
        if (paged.isSuccess()) {
          return toPage(paged.value, input.page, pageSize, formatDatesList);
        }
        return throwOrpcFailure(paged, this.logger);
      }

      const result = await this.listExperimentsUseCase.execute(
        session.user.id,
        scope,
        input.status,
        input.search,
      );
      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "experiment", action: "read" })
  @Implement(experimentContract.getExperiment)
  getExperiment(@Session() session: UserSession) {
    return implement(experimentContract.getExperiment).handler(async ({ input }) => {
      const result = await this.getExperimentUseCase.execute(input.id, session.user.id);
      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "experiment", action: "read" })
  @Implement(experimentContract.getExperimentAccess)
  getExperimentAccess(@Session() session: UserSession) {
    return implement(experimentContract.getExperimentAccess).handler(async ({ input }) => {
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

  @CanAccess({ resource: "experiment", action: "update" })
  @Implement(experimentContract.updateExperiment)
  updateExperiment() {
    return implement(experimentContract.updateExperiment).handler(async ({ input }) => {
      const { id, ...body } = input;
      const transformedBody = {
        ...body,
        embargoUntil: body.embargoUntil ? new Date(body.embargoUntil) : undefined,
      };
      const result = await this.updateExperimentUseCase.execute(id, transformedBody);
      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "experiment", action: "manage" })
  @Implement(experimentContract.setVisibility)
  setVisibility() {
    return implement(experimentContract.setVisibility).handler(async ({ input }) => {
      const result = await this.setVisibilityUseCase.execute(
        "experiment",
        input.id,
        input.visibility,
      );
      if (result.isSuccess()) {
        return result.value;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "experiment", action: "manage" })
  @Implement(experimentContract.deleteExperiment)
  deleteExperiment(@Session() session: UserSession) {
    return implement(experimentContract.deleteExperiment).handler(async ({ input }) => {
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

      const result = await this.deleteExperimentUseCase.execute(input.id);
      if (result.isSuccess()) {
        return undefined;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }
}
