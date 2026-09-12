import { Inject, Injectable, Logger } from "@nestjs/common";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../../experiments/core/repositories/experiment.repository";
import type { ExperimentDeviceSeriesDto } from "../../../core/models/experiment-device.model";
import { IOT_DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../core/ports/databricks.port";

/**
 * Authorized on the experiment, never the device: the tab lists publishers the
 * caller cannot open, and `device:read` would refuse a chart for exactly those
 * rows. Keyed by client id, because an unregistered publisher has no registry row.
 */
@Injectable()
export class GetExperimentDeviceSeriesUseCase {
  private readonly logger = new Logger(GetExperimentDeviceSeriesUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly authorizationService: AuthorizationService,
    @Inject(IOT_DATABRICKS_PORT)
    private readonly databricksPort: DatabricksPort,
  ) {}

  async execute(
    experimentId: string,
    clientId: string,
    from: string,
    to: string,
    bucket: "hour" | "day",
    userId: string,
  ): Promise<Result<ExperimentDeviceSeriesDto>> {
    this.logger.log({
      msg: "Reading an experiment device series",
      operation: "getExperimentDeviceSeries",
      experimentId,
      userId,
    });

    const accessResult = await this.experimentRepository.checkAccess(experimentId, userId);
    if (accessResult.isFailure()) {
      return failure(accessResult.error);
    }
    if (!accessResult.value.experiment) {
      return failure(AppError.notFound(`Experiment with ID ${experimentId} not found`));
    }

    const decision = await this.authorizationService.can(userId, {
      resourceType: "experiment",
      resourceId: experimentId,
      action: "read",
    });
    if (!decision.allow || decision.reason === "public") {
      return failure(
        AppError.forbidden("Only experiment collaborators or managers can view its devices"),
      );
    }

    const result = await this.databricksPort.getExperimentDeviceSeries(
      experimentId,
      clientId,
      from,
      to,
      bucket,
    );
    if (result.isFailure()) {
      this.logger.warn({
        msg: "Experiment device series lookup failed; the chart renders as unavailable",
        operation: "getExperimentDeviceSeries",
        experimentId,
        errorCode: result.error.code,
      });
      return success({ buckets: [], pipelineUnavailable: true });
    }

    return success({ buckets: result.value, pipelineUnavailable: false });
  }
}
