import { Injectable, Logger } from "@nestjs/common";

import type {
  ExperimentUploadWebhookPayload,
  ExperimentUploadWebhookResponse,
} from "@repo/api/domains/experiment/upload-webhook/experiment-upload-webhook.schema";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import { ExperimentRepository } from "../../../core/repositories/experiment.repository";

/**
 * Tells the uploader how their upload ended, once the upload task has seen its rows land in
 * the experiment's table or given up waiting. The upload itself is long done by then.
 */
@Injectable()
export class NotifyUploadOutcomeUseCase {
  private readonly logger = new Logger(NotifyUploadOutcomeUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly notifications: NotificationDispatchService,
  ) {}

  async execute(
    payload: ExperimentUploadWebhookPayload,
  ): Promise<Result<ExperimentUploadWebhookResponse>> {
    const { experimentId, uploadId, userId, outcome, uploadTableName } = payload;

    const experimentResult = await this.experimentRepository.findOne(experimentId);
    if (experimentResult.isFailure()) {
      return failure(experimentResult.error);
    }

    const experiment = experimentResult.value;
    if (!experiment) {
      return failure(AppError.notFound("Experiment not found"));
    }

    // The uploader is the recipient, so no actor: dispatch skips whoever caused an event.
    const target = {
      recipientIds: [userId],
      resource: { type: "experiment", id: experimentId },
    } satisfies Pick<
      Parameters<NotificationDispatchService["dispatch"]>[0],
      "recipientIds" | "resource"
    >;

    const dispatched =
      outcome === "ready"
        ? await this.notifications.dispatch({
            type: "data_upload_completed",
            ...target,
            dedupeKey: `data_upload_completed:${uploadId}`,
            params: { experimentName: experiment.name },
          })
        : await this.notifications.dispatch({
            type: "data_upload_failed",
            ...target,
            dedupeKey: `data_upload_failed:${uploadId}`,
            params: { experimentName: experiment.name, fileName: uploadTableName },
          });

    if (dispatched.isFailure()) {
      return failure(dispatched.error);
    }

    this.logger.log({
      msg: "Notified the uploader of the upload outcome",
      operation: "notifyUploadOutcome",
      experimentId,
      uploadId,
      outcome,
    });

    return success({ success: true });
  }
}
