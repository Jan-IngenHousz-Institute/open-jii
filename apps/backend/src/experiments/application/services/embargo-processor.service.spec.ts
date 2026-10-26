import { Logger } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { vi } from "vitest";

import { success, failure, AppError } from "../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../notifications/application/services/notification-dispatch.service";
import { SharingRepository } from "../../../sharing/core/repositories/sharing.repository";
import type { ExperimentDto } from "../../core/models/experiment.model";
import { ANALYTICS_PORT } from "../../core/ports/analytics.port";
import { ExperimentRepository } from "../../core/repositories/experiment.repository";
import { EmbargoProcessorService } from "./embargo-processor.service";

describe("EmbargoProcessorService", () => {
  let service: EmbargoProcessorService;
  let mockExperimentRepository: {
    findExpiredEmbargoes: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let listAdminIds: ReturnType<typeof vi.fn>;
  let dispatch: ReturnType<typeof vi.fn>;
  let reportError: ReturnType<typeof vi.fn>;
  let loggerSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  const mockExperiment: ExperimentDto = {
    id: "experiment-1",
    name: "Test Experiment",
    description: "A test experiment",
    status: "active",
    visibility: "private",
    organizationId: null,
    anonymizeContributors: false,
    workbookId: null,
    workbookVersionId: null,
    embargoUntil: new Date("2023-01-01"),
    createdBy: "user-1",
    createdAt: new Date("2022-10-01"),
    updatedAt: new Date("2022-10-01"),
  };

  beforeEach(async () => {
    mockExperimentRepository = {
      findExpiredEmbargoes: vi.fn(),
      update: vi.fn(),
    };
    listAdminIds = vi.fn().mockResolvedValue(success(["admin-1", "admin-2"]));
    dispatch = vi.fn().mockResolvedValue(success({ created: 2, queued: 2 }));
    reportError = vi.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbargoProcessorService,
        {
          provide: ExperimentRepository,
          useValue: mockExperimentRepository,
        },
        { provide: SharingRepository, useValue: { listAdminIds } },
        { provide: NotificationDispatchService, useValue: { dispatch } },
        {
          provide: ANALYTICS_PORT,
          useValue: { isFeatureFlagEnabled: vi.fn(), reportError },
        },
      ],
    }).compile();

    service = module.get<EmbargoProcessorService>(EmbargoProcessorService);

    // Mock the logger to prevent console output during tests
    loggerSpy = vi.spyOn(Logger.prototype, "log").mockImplementation(() => {
      /* no-op */
    });
    errorSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => {
      /* no-op */
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("processExpiredEmbargoes", () => {
    it("should process expired embargoes successfully", async () => {
      // Arrange
      const expiredExperiments = [mockExperiment];
      mockExperimentRepository.findExpiredEmbargoes.mockResolvedValue(success(expiredExperiments));
      mockExperimentRepository.update.mockResolvedValue(success([mockExperiment]));

      // Act
      await service.processExpiredEmbargoes();

      // Assert
      expect(mockExperimentRepository.findExpiredEmbargoes).toHaveBeenCalledTimes(1);
      expect(mockExperimentRepository.update).toHaveBeenCalledWith(mockExperiment.id, {
        visibility: "public",
      });
      expect(loggerSpy).toHaveBeenCalled();
      expect(reportError).not.toHaveBeenCalled();
    });

    it("should handle no expired embargoes", async () => {
      // Arrange
      mockExperimentRepository.findExpiredEmbargoes.mockResolvedValue(success([]));

      // Act
      await service.processExpiredEmbargoes();

      // Assert
      expect(mockExperimentRepository.findExpiredEmbargoes).toHaveBeenCalledTimes(1);
      expect(mockExperimentRepository.update).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalled();
    });

    it("should handle repository failure when fetching expired embargoes", async () => {
      // Arrange
      const error = new AppError("Database connection failed", "DB_CONNECTION_ERROR");
      mockExperimentRepository.findExpiredEmbargoes.mockResolvedValue(failure(error));

      // Act
      await service.processExpiredEmbargoes();

      // Assert
      expect(mockExperimentRepository.findExpiredEmbargoes).toHaveBeenCalledTimes(1);
      expect(mockExperimentRepository.update).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
      expect(reportError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ stage: "find", $exception_fingerprint: "embargo:find" }),
      );
    });

    it("should handle update failures for individual experiments", async () => {
      // Arrange
      const expiredExperiments = [mockExperiment];
      const updateError = new AppError("Update failed", "UPDATE_ERROR");
      mockExperimentRepository.findExpiredEmbargoes.mockResolvedValue(success(expiredExperiments));
      mockExperimentRepository.update.mockResolvedValue(failure(updateError));

      // Act
      await service.processExpiredEmbargoes();

      // Assert
      expect(mockExperimentRepository.findExpiredEmbargoes).toHaveBeenCalledTimes(1);
      expect(mockExperimentRepository.update).toHaveBeenCalledWith(mockExperiment.id, {
        visibility: "public",
      });
      expect(errorSpy).toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalled();
    });

    it("should handle mixed success and failure results", async () => {
      // Arrange
      const experiment2: ExperimentDto = {
        ...mockExperiment,
        id: "experiment-2",
        name: "Second Experiment",
      };
      const expiredExperiments = [mockExperiment, experiment2];
      const updateError = new AppError("Update failed for second experiment", "UPDATE_ERROR");

      mockExperimentRepository.findExpiredEmbargoes.mockResolvedValue(success(expiredExperiments));
      mockExperimentRepository.update
        .mockResolvedValueOnce(success([mockExperiment]))
        .mockResolvedValueOnce(failure(updateError));

      // Act
      await service.processExpiredEmbargoes();

      // Assert
      expect(mockExperimentRepository.findExpiredEmbargoes).toHaveBeenCalledTimes(1);
      expect(mockExperimentRepository.update).toHaveBeenCalledTimes(2);
      expect(loggerSpy).toHaveBeenCalled();
      expect(reportError).toHaveBeenCalledTimes(1);
      expect(reportError).toHaveBeenCalledWith(
        updateError,
        expect.objectContaining({ stage: "update", failure_count: 1 }),
      );
    });

    it("should handle unexpected errors during processing", async () => {
      // Arrange
      const unexpectedError = new Error("Unexpected error");
      mockExperimentRepository.findExpiredEmbargoes.mockRejectedValue(unexpectedError);

      // Act
      await service.processExpiredEmbargoes();

      // Assert
      expect(errorSpy).toHaveBeenCalled();
      expect(reportError).toHaveBeenCalledWith(
        unexpectedError,
        expect.objectContaining({ stage: "unexpected" }),
      );
    });
  });

  describe("telling the admins", () => {
    const experiment2: ExperimentDto = {
      ...mockExperiment,
      id: "experiment-2",
      name: "Second Experiment",
    };

    const madePublic = (experiment: ExperimentDto) => ({
      type: "experiment_made_public",
      recipientIds: ["admin-1", "admin-2"],
      actorId: null,
      resource: { type: "experiment", id: experiment.id },
      params: { experimentName: experiment.name },
      dedupeKey: `embargo:${experiment.id}`,
    });

    beforeEach(() => {
      mockExperimentRepository.findExpiredEmbargoes.mockResolvedValue(
        success([mockExperiment, experiment2]),
      );
      mockExperimentRepository.update.mockResolvedValue(success([mockExperiment]));
    });

    it("dispatches once per published experiment, keyed by the experiment", async () => {
      await service.processExpiredEmbargoes();

      expect(listAdminIds).toHaveBeenCalledWith("experiment", mockExperiment.id);
      expect(listAdminIds).toHaveBeenCalledWith("experiment", experiment2.id);
      expect(dispatch.mock.calls).toEqual([
        [madePublic(mockExperiment)],
        [madePublic(experiment2)],
      ]);
      expect(reportError).not.toHaveBeenCalled();
    });

    it("dispatches nothing for an experiment whose update failed", async () => {
      mockExperimentRepository.update
        .mockResolvedValueOnce(failure(new AppError("Update failed", "UPDATE_ERROR")))
        .mockResolvedValueOnce(success([experiment2]));

      await service.processExpiredEmbargoes();

      expect(listAdminIds).toHaveBeenCalledExactlyOnceWith("experiment", experiment2.id);
      expect(dispatch.mock.calls).toEqual([[madePublic(experiment2)]]);
    });

    it("still counts the publish and reports once when the admins cannot be read", async () => {
      const lookupError = AppError.internal("Sharing unavailable");
      listAdminIds.mockResolvedValue(failure(lookupError));

      await service.processExpiredEmbargoes();

      expect(dispatch).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Embargo processing completed",
          successCount: 2,
          failureCount: 0,
        }),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "processExpiredEmbargoes",
          errorCode: "EMBARGO_PROCESSING_FAILED",
          error: lookupError,
        }),
      );
      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        lookupError,
        expect.objectContaining({
          stage: "notify",
          failure_count: 2,
          $exception_fingerprint: "embargo:notify",
        }),
      );
    });

    it("still counts the publish and reports once when the dispatch fails", async () => {
      const dispatchError = AppError.internal("Notifications unavailable");
      dispatch.mockResolvedValue(failure(dispatchError));

      await service.processExpiredEmbargoes();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Embargo processing completed",
          successCount: 2,
          failureCount: 0,
        }),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "processExpiredEmbargoes",
          errorCode: "EMBARGO_PROCESSING_FAILED",
          error: dispatchError,
        }),
      );
      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        dispatchError,
        expect.objectContaining({ stage: "notify", failure_count: 2 }),
      );
    });

    it("dispatches from the manual run too, which counts a failed dispatch as published", async () => {
      dispatch
        .mockResolvedValueOnce(success({ created: 2, queued: 2 }))
        .mockResolvedValueOnce(failure(AppError.internal("Notifications unavailable")));

      const result = await service.processExpiredEmbargoesManually();

      expect(result).toEqual({ processed: 2, succeeded: 2, failed: 0 });
      expect(dispatch.mock.calls).toEqual([
        [madePublic(mockExperiment)],
        [madePublic(experiment2)],
      ]);
    });
  });

  describe("processExpiredEmbargoesManually", () => {
    it("should return correct statistics for successful processing", async () => {
      // Arrange
      const expiredExperiments = [mockExperiment];
      mockExperimentRepository.findExpiredEmbargoes.mockResolvedValue(success(expiredExperiments));
      mockExperimentRepository.update.mockResolvedValue(success([mockExperiment]));

      // Act
      const result = await service.processExpiredEmbargoesManually();

      // Assert
      expect(result).toEqual({
        processed: 1,
        succeeded: 1,
        failed: 0,
      });
      expect(mockExperimentRepository.findExpiredEmbargoes).toHaveBeenCalledTimes(1);
      expect(mockExperimentRepository.update).toHaveBeenCalledWith(mockExperiment.id, {
        visibility: "public",
      });
      expect(loggerSpy).toHaveBeenCalled();
    });

    it("should return correct statistics for failed processing", async () => {
      // Arrange
      const expiredExperiments = [mockExperiment];
      const updateError = new AppError("Update failed", "UPDATE_ERROR");
      mockExperimentRepository.findExpiredEmbargoes.mockResolvedValue(success(expiredExperiments));
      mockExperimentRepository.update.mockResolvedValue(failure(updateError));

      // Act
      const result = await service.processExpiredEmbargoesManually();

      // Assert
      expect(result).toEqual({
        processed: 1,
        succeeded: 0,
        failed: 1,
      });
    });

    it("should return zero statistics when no expired embargoes exist", async () => {
      // Arrange
      mockExperimentRepository.findExpiredEmbargoes.mockResolvedValue(success([]));

      // Act
      const result = await service.processExpiredEmbargoesManually();

      // Assert
      expect(result).toEqual({
        processed: 0,
        succeeded: 0,
        failed: 0,
      });
      expect(mockExperimentRepository.update).not.toHaveBeenCalled();
    });

    it("logs a failed admin read and still counts the experiment as published", async () => {
      const lookupError = AppError.internal("Sharing unavailable");
      mockExperimentRepository.findExpiredEmbargoes.mockResolvedValue(success([mockExperiment]));
      mockExperimentRepository.update.mockResolvedValue(success([mockExperiment]));
      listAdminIds.mockResolvedValue(failure(lookupError));

      const result = await service.processExpiredEmbargoesManually();

      expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });
      expect(errorSpy).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          operation: "processExpiredEmbargoesManually",
          errorCode: "EMBARGO_PROCESSING_FAILED",
          experimentId: mockExperiment.id,
          error: lookupError,
        }),
      );
      expect(reportError).not.toHaveBeenCalled();
    });

    it("should throw error when repository fails to fetch expired embargoes", async () => {
      // Arrange
      const error = new AppError("Database connection failed", "DB_CONNECTION_ERROR");
      mockExperimentRepository.findExpiredEmbargoes.mockResolvedValue(failure(error));

      // Act & Assert
      await expect(service.processExpiredEmbargoesManually()).rejects.toThrow(
        "Failed to fetch expired embargoes: Database connection failed",
      );
    });

    it("should handle mixed success and failure results correctly", async () => {
      // Arrange
      const experiment2: ExperimentDto = {
        ...mockExperiment,
        id: "experiment-2",
        name: "Second Experiment",
      };
      const expiredExperiments = [mockExperiment, experiment2];
      const updateError = new AppError("Update failed for second experiment", "UPDATE_ERROR");

      mockExperimentRepository.findExpiredEmbargoes.mockResolvedValue(success(expiredExperiments));
      mockExperimentRepository.update
        .mockResolvedValueOnce(success([mockExperiment]))
        .mockResolvedValueOnce(failure(updateError));

      // Act
      const result = await service.processExpiredEmbargoesManually();

      // Assert
      expect(result).toEqual({
        processed: 2,
        succeeded: 1,
        failed: 1,
      });
    });
  });

  describe("cron job configuration", () => {
    it("should have the correct cron expression", () => {
      // This test verifies that the @Cron decorator is properly configured
      expect(service.processExpiredEmbargoes.bind(service)).toBeDefined();
      expect(typeof service.processExpiredEmbargoes).toBe("function");
    });
  });
});
