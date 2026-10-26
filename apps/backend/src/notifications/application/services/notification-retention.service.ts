import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { ErrorCodes } from "../../../common/utils/error-codes";
import type { AppError } from "../../../common/utils/fp-utils";
import { ANALYTICS_PORT } from "../../core/ports/analytics.port";
import type { AnalyticsPort } from "../../core/ports/analytics.port";
import { NotificationRepository } from "../../core/repositories/notification.repository";
import type { RetentionPeriods } from "../../core/repositories/notification.repository";

export const READ_RETENTION_DAYS = 90;
export const RETENTION_DAYS = 365;
export const RETENTION_BATCH_SIZE = 2000;
export const RETENTION_CRON = "notification-retention";

const OPERATION = "notification-retention";

const RETENTION_PERIODS: RetentionPeriods = {
  readAfterDays: READ_RETENTION_DAYS,
  allAfterDays: RETENTION_DAYS,
  batchSize: RETENTION_BATCH_SIZE,
};

@Injectable()
export class NotificationRetentionService {
  private readonly logger = new Logger(NotificationRetentionService.name);

  constructor(
    private readonly notificationRepository: NotificationRepository,
    @Inject(ANALYTICS_PORT)
    private readonly analyticsPort: AnalyticsPort,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: RETENTION_CRON, timeZone: "UTC" })
  async runOnSchedule(): Promise<void> {
    await this.run();
  }

  /** Every task fires the schedule; the lock lets one of them do the work. */
  async run(periods: RetentionPeriods = RETENTION_PERIODS): Promise<void> {
    const locked = await this.notificationRepository.tryRetentionLock();

    if (locked.isFailure()) {
      this.reportFailure(locked.error, "lock");
      return;
    }

    if (!locked.value) {
      this.logger.log({
        msg: "Notification retention skipped: another task is running it",
        operation: OPERATION,
      });
      return;
    }

    let deleted = 0;
    let batches = 0;
    let removed = 0;
    let deleteFailure: AppError | null = null;

    do {
      const batch = await this.notificationRepository.deleteExpiredBatch(periods);
      if (batch.isFailure()) {
        deleteFailure = batch.error;
        break;
      }
      removed = batch.value;
      deleted += removed;
      batches++;
    } while (removed === periods.batchSize);

    const released = await this.notificationRepository.releaseRetentionLock();

    if (deleteFailure) {
      this.reportFailure(deleteFailure, "delete");
      return;
    }

    this.logger.log({
      msg: "Notification retention completed",
      operation: OPERATION,
      deleted,
      batches,
    });

    if (released.isFailure()) {
      this.reportFailure(released.error, "unlock");
      return;
    }

    if (!released.value) {
      this.logger.warn({
        msg: "Notification retention lock was gone at release: the session was replaced mid-run, or the pool is no longer one connection",
        operation: OPERATION,
      });
    }
  }

  private reportFailure(error: AppError, stage: "lock" | "delete" | "unlock"): void {
    this.logger.error({
      msg: "Notification retention failed",
      errorCode: ErrorCodes.NOTIFICATION_RETENTION_FAILED,
      operation: OPERATION,
      stage,
      error,
    });
    this.analyticsPort.reportError(error, {
      operation: OPERATION,
      stage,
      error_code: ErrorCodes.NOTIFICATION_RETENTION_FAILED,
      $exception_fingerprint: `${OPERATION}:${stage}`,
    });
  }
}
