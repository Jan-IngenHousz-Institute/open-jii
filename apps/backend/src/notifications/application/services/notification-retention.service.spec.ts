import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { vi } from "vitest";

import { ErrorCodes } from "../../../common/utils/error-codes";
import { AppError, failure, success } from "../../../common/utils/fp-utils";
import { ANALYTICS_PORT } from "../../core/ports/analytics.port";
import { NotificationRepository } from "../../core/repositories/notification.repository";
import {
  READ_RETENTION_DAYS,
  RETENTION_DAYS,
  NotificationRetentionService,
} from "./notification-retention.service";

const PERIODS = { readAfterDays: 90, allAfterDays: 365, batchSize: 2000 };

describe("NotificationRetentionService", () => {
  let service: NotificationRetentionService;
  let tryRetentionLock: ReturnType<typeof vi.fn>;
  let deleteExpiredBatch: ReturnType<typeof vi.fn>;
  let releaseRetentionLock: ReturnType<typeof vi.fn>;
  let reportError: ReturnType<typeof vi.fn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tryRetentionLock = vi.fn().mockResolvedValue(success(true));
    deleteExpiredBatch = vi.fn().mockResolvedValue(success(0));
    releaseRetentionLock = vi.fn().mockResolvedValue(success(true));
    reportError = vi.fn();

    const module = await Test.createTestingModule({
      providers: [
        NotificationRetentionService,
        {
          provide: NotificationRepository,
          useValue: { tryRetentionLock, deleteExpiredBatch, releaseRetentionLock },
        },
        { provide: ANALYTICS_PORT, useValue: { reportError } },
      ],
    }).compile();

    service = module.get(NotificationRetentionService);

    logSpy = vi.spyOn(Logger.prototype, "log").mockImplementation(() => {
      /* no-op */
    });
    warnSpy = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {
      /* no-op */
    });
    errorSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => {
      /* no-op */
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const expectReportedOnce = (error: AppError, stage: string) => {
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: ErrorCodes.NOTIFICATION_RETENTION_FAILED,
        operation: "notification-retention",
        stage,
      }),
    );
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(error, {
      operation: "notification-retention",
      stage,
      error_code: ErrorCodes.NOTIFICATION_RETENTION_FAILED,
      $exception_fingerprint: `notification-retention:${stage}`,
    });
  };

  it("locks, deletes with the retention periods and a batch of 2,000, then releases", async () => {
    await service.run();

    expect(deleteExpiredBatch).toHaveBeenCalledWith(PERIODS);
    expect(tryRetentionLock.mock.invocationCallOrder[0]).toBeLessThan(
      deleteExpiredBatch.mock.invocationCallOrder[0],
    );
    expect(deleteExpiredBatch.mock.invocationCallOrder[0]).toBeLessThan(
      releaseRetentionLock.mock.invocationCallOrder[0],
    );
  });

  it("deletes batches until one comes back short, and logs the counts", async () => {
    deleteExpiredBatch
      .mockResolvedValueOnce(success(2000))
      .mockResolvedValueOnce(success(2000))
      .mockResolvedValueOnce(success(5));

    await service.run();

    expect(deleteExpiredBatch).toHaveBeenCalledTimes(3);
    expect(releaseRetentionLock).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "notification-retention", deleted: 4005, batches: 3 }),
    );
    expect(warnSpy).not.toHaveBeenCalled();
    expect(reportError).not.toHaveBeenCalled();
  });

  it("skips the run when another task holds the lock, and reports nothing", async () => {
    tryRetentionLock.mockResolvedValue(success(false));

    await service.run();

    expect(deleteExpiredBatch).not.toHaveBeenCalled();
    expect(releaseRetentionLock).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: expect.stringContaining("another task") as unknown,
        operation: "notification-retention",
      }),
    );
    expect(errorSpy).not.toHaveBeenCalled();
    expect(reportError).not.toHaveBeenCalled();
  });

  it("reports a failed lock once, and deletes nothing", async () => {
    const error = AppError.repositoryError("connection refused");
    tryRetentionLock.mockResolvedValue(failure(error));

    await expect(service.run()).resolves.toBeUndefined();

    expect(deleteExpiredBatch).not.toHaveBeenCalled();
    expect(releaseRetentionLock).not.toHaveBeenCalled();
    expectReportedOnce(error, "lock");
  });

  it("releases the lock after a failed batch and reports the delete once", async () => {
    const error = AppError.repositoryError("connection reset");
    deleteExpiredBatch.mockResolvedValueOnce(success(2000)).mockResolvedValueOnce(failure(error));
    releaseRetentionLock.mockResolvedValue(failure(AppError.repositoryError("connection gone")));

    await expect(service.run()).resolves.toBeUndefined();

    expect(deleteExpiredBatch).toHaveBeenCalledTimes(2);
    expect(releaseRetentionLock).toHaveBeenCalledTimes(1);
    expectReportedOnce(error, "delete");
  });

  it("reports a failed release once when the batches succeeded", async () => {
    const error = AppError.repositoryError("connection gone");
    releaseRetentionLock.mockResolvedValue(failure(error));

    await expect(service.run()).resolves.toBeUndefined();

    expectReportedOnce(error, "unlock");
  });

  it("warns when the release found no lock held by this session", async () => {
    releaseRetentionLock.mockResolvedValue(success(false));

    await service.run();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "notification-retention" }),
    );
    expect(reportError).not.toHaveBeenCalled();
  });

  it("keeps the periods the page states: read notifications are kept for 90 days, unread ones for a year", () => {
    expect(READ_RETENTION_DAYS).toBe(90);
    expect(RETENTION_DAYS).toBe(365);
  });
});
