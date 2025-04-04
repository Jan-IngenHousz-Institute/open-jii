import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { fromPartial } from "@total-typescript/shoehorn";

import { ExperimentsController } from "./experiments.controller";
import { ExperimentsService } from "./experiments.service";
import { ExperimentFilterPipe } from "./pipes/experiment-filter.pipe";
import type { ExperimentFilter } from "./pipes/experiment-filter.pipe";
import type {
  CreateExperimentDto,
  UpdateExperimentDto,
} from "./schemas/experiment.schema";

describe("ExperimentsController", () => {
  let controller: ExperimentsController;
  let service: ExperimentsService;

  // Test constants
  const UUID = {
    USER: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    EXPERIMENT: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
  };

  // Test fixtures
  const mockExperiment = fromPartial({
    id: UUID.EXPERIMENT,
    name: "Test Experiment",
    status: "active",
    visibility: "private",
    embargoIntervalDays: 90,
    createdBy: UUID.USER,
  });

  // Test constants
  const UUID = {
    USER: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    EXPERIMENT: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
  };

  // Test fixtures
  const mockExperiment = fromPartial({
    id: UUID.EXPERIMENT,
    name: "Test Experiment",
    status: "active",
    visibility: "private",
    embargoIntervalDays: 90,
    createdBy: UUID.USER,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExperimentsController],
      providers: [
        {
          provide: ExperimentsService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: UUID.EXPERIMENT }),
            findAll: jest.fn().mockResolvedValue([mockExperiment]),
            findOne: jest.fn().mockResolvedValue(mockExperiment),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        ExperimentFilterPipe,
      ],
    }).compile();

    controller = module.get<ExperimentsController>(ExperimentsController);
    service = module.get<ExperimentsService>(ExperimentsService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create an experiment with valid data and pass it to the service", async () => {
      // Arrange
      const createDto: CreateExperimentDto = {
        name: "Test Experiment",
        status: "provisioning",
        visibility: "private",
        embargoIntervalDays: 90,
      };

      // Act
      await controller.create(createDto, UUID.USER);

      // Assert
      expect(service.create).toHaveBeenCalledWith(createDto, UUID.USER);
    });
  });

  describe("findAll", () => {
    it("should pass the userId and filter to the service with no filter", async () => {
      // Act
      await controller.findAll(UUID.USER);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(UUID.USER, undefined);
    });

    it("should pass the userId and filter to the service with 'my' filter", async () => {
      // Arrange
      const filter: ExperimentFilter = "my";

      // Act
      await controller.findAll(UUID.USER, filter);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(UUID.USER, filter);
    });

    it("should pass the userId and filter to the service with 'member' filter", async () => {
      // Arrange
      const filter: ExperimentFilter = "member";

      // Act
      await controller.findAll(UUID.USER, filter);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(UUID.USER, filter);
    });

    it("should pass the userId and filter to the service with 'related' filter", async () => {
      // Arrange
      const filter: ExperimentFilter = "related";

      // Act
      await controller.findAll(UUID.USER, filter);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(UUID.USER, filter);
    });
  });

  describe("findOne", () => {
    it("should return experiment data when found", async () => {
      // Act
      const result = await controller.findOne(UUID.EXPERIMENT);

      // Assert
      expect(service.findOne).toHaveBeenCalledWith(UUID.EXPERIMENT);
      expect(result).toEqual(mockExperiment);
    });

    it("should throw NotFoundException when experiment is not found", async () => {
      // Arrange
      jest.spyOn(service, "findOne").mockResolvedValue(null);

      // Act & Assert
      await expect(controller.findOne(UUID.EXPERIMENT)).rejects.toThrow(
        new NotFoundException(
          `Experiment with ID ${UUID.EXPERIMENT} not found`,
        ),
      );
      expect(service.findOne).toHaveBeenCalledWith(UUID.EXPERIMENT);
    });
  });

  describe("update", () => {
    it("should pass update data to service when experiment exists", async () => {
      // Arrange
      const updateDto: UpdateExperimentDto = {
        name: "Updated Experiment",
        status: "active",
      };

      // Act
      await controller.update(UUID.EXPERIMENT, updateDto);

      // Assert
      expect(service.findOne).toHaveBeenCalledWith(UUID.EXPERIMENT);
      expect(service.update).toHaveBeenCalledWith(UUID.EXPERIMENT, updateDto);
    });

    it("should accept empty update data", async () => {
      // Arrange
      const emptyDto: UpdateExperimentDto = {};

      // Act
      await controller.update(UUID.EXPERIMENT, emptyDto);

      // Assert
      expect(service.findOne).toHaveBeenCalledWith(UUID.EXPERIMENT);
      expect(service.update).toHaveBeenCalledWith(UUID.EXPERIMENT, emptyDto);
    });

    it("should throw NotFoundException when trying to update non-existent experiment", async () => {
      // Arrange
      const updateDto: UpdateExperimentDto = { name: "Will Not Update" };
      jest.spyOn(service, "findOne").mockResolvedValue(null);

      // Act & Assert
      await expect(
        controller.update(UUID.EXPERIMENT, updateDto),
      ).rejects.toThrow(
        new NotFoundException(
          `Experiment with ID ${UUID.EXPERIMENT} not found`,
        ),
      );

      expect(service.findOne).toHaveBeenCalledWith(UUID.EXPERIMENT);
      expect(service.update).not.toHaveBeenCalled();
    });
  });
});
