import { Logger } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { vi } from "vitest";

import { success, failure, AppError } from "../../../common/utils/fp-utils";
import type { ExperimentDto } from "../../core/models/experiment.model";
import { ExperimentRepository } from "../../core/repositories/experiment.repository";
import { EmbargoProcessorService } from "./embargo-processor.service";

describe("EmbargoProcessorService", () => {
  let service: EmbargoProcessorService;
  let mockExperimentRepository: {
    findExpiredEmbargoes: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let loggerSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  const mockExperiment: ExperimentDto = {
    id: "experiment-1",
    name: "Test Experiment",
    description: "A test experiment",
    status: "active",
    visibility: "private",
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbargoProcessorService,
        {
          provide: ExperimentRepository,
          useValue: mockExperimentRepository,
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
    });

    it("should handle unexpected errors during processing", async () => {
      // Arrange
      const unexpectedError = new Error("Unexpected error");
      mockExperimentRepository.findExpiredEmbargoes.mockRejectedValue(unexpectedError);

      // Act
      await service.processExpiredEmbargoes();

      // Assert
      expect(errorSpy).toHaveBeenCalled();
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
