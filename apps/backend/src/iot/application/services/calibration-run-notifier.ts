import { Injectable, Logger } from "@nestjs/common";

import { AuthorizationService } from "../../../authorization/authorization.service";
import { ErrorCodes } from "../../../common/utils/error-codes";
import { NotificationDispatchService } from "../../../notifications/application/services/notification-dispatch.service";
import { SharingRepository } from "../../../sharing/core/repositories/sharing.repository";
import { IotCalibrationRunRepository } from "../../core/repositories/iot-calibration-run.repository";

interface NotifiedRun {
  id: string;
  deviceId: string;
  definitionId: string;
  requestedBy: string;
}

const logContext = (operation: string, run: NotifiedRun) => ({
  operation,
  errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
  runId: run.id,
  deviceId: run.deviceId,
});

/**
 * The one place a calibration run notification is sent from. It runs after the
 * caller's write has succeeded; a failure here is logged and never fails the run,
 * the approval or the rejection.
 */
@Injectable()
export class CalibrationRunNotifier {
  private readonly logger = new Logger(CalibrationRunNotifier.name);

  constructor(
    private readonly runRepository: IotCalibrationRunRepository,
    private readonly sharingRepository: SharingRepository,
    private readonly notifications: NotificationDispatchService,
    private readonly authz: AuthorizationService,
  ) {}

  async runAwaitingApproval(operation: string, run: NotifiedRun): Promise<void> {
    const context = logContext(operation, run);

    const labels = await this.labels(run.id, context);
    if (!labels) {
      return;
    }

    const adminIds = await this.sharingRepository.listAdminIds("device", run.deviceId);
    if (adminIds.isFailure()) {
      this.logger.error({
        msg: "Could not read who manages the device, nobody was notified of the run",
        ...context,
        error: adminIds.error,
      });
      return;
    }

    const dispatched = await this.notifications.dispatch({
      type: "calibration_run_awaiting_approval",
      recipientIds: adminIds.value,
      actorId: run.requestedBy,
      resource: { type: "device", id: run.deviceId },
      params: labels,
    });
    if (dispatched.isFailure()) {
      this.logger.error({
        msg: "Failed to notify the device's managers, the run was still recorded",
        ...context,
        error: dispatched.error,
      });
    }
  }

  async runReviewed(
    operation: string,
    decision: "approved" | "rejected",
    run: NotifiedRun,
    reviewerId: string,
  ): Promise<void> {
    const context = logContext(operation, run);

    const labels = await this.labels(run.id, context);
    if (!labels) {
      return;
    }

    // A requester who lost the device would get an email naming it and a link they cannot open.
    const access = await this.authz
      .can(run.requestedBy, { resourceType: "device", resourceId: run.deviceId, action: "read" })
      .catch((error: unknown) => {
        this.logger.error({
          msg: "Could not check the requester can still read the device, the decision was not sent",
          ...context,
          requesterId: run.requestedBy,
          error,
        });
        return null;
      });
    if (!access) {
      return;
    }
    if (!access.allow) {
      this.logger.log({
        msg: "The requester can no longer read the device, the decision was not sent",
        operation,
        runId: run.id,
        deviceId: run.deviceId,
        requesterId: run.requestedBy,
      });
      return;
    }

    const dispatched = await this.notifications.dispatch({
      type: decision === "approved" ? "calibration_run_approved" : "calibration_run_rejected",
      recipientIds: [run.requestedBy],
      actorId: reviewerId,
      resource: { type: "device", id: run.deviceId },
      params: labels,
    });
    if (dispatched.isFailure()) {
      this.logger.error({
        msg: `Failed to notify the requester, the run was still ${decision}`,
        ...context,
        error: dispatched.error,
      });
    }
  }

  private async labels(runId: string, context: ReturnType<typeof logContext>) {
    const labels = await this.runRepository.findRunLabels(runId);
    if (labels.isFailure() || !labels.value) {
      this.logger.error({
        msg: "Could not name the run's device and definition, nobody was notified",
        ...context,
        ...(labels.isFailure() ? { error: labels.error } : {}),
      });
      return null;
    }
    return labels.value;
  }
}
