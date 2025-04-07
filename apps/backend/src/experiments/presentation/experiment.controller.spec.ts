import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { fromPartial } from "@total-typescript/shoehorn";

import { ExperimentFilterPipe } from "./application/pipes/experiment-filter.pipe";
import type { ExperimentFilter } from "./application/pipes/experiment-filter.pipe";
import { CreateExperimentUseCase } from "./application/use-cases/create-experiment.use-case";
import { GetExperimentUseCase } from "./application/use-cases/get-experiment.use-case";
import { ListExperimentsUseCase } from "./application/use-cases/list-experiments.use-case";
import { UpdateExperimentUseCase } from "./application/use-cases/update-experiment.use-case";
import type {
  CreateExperimentDto,
  UpdateExperimentDto,
} from "./core/schemas/experiment.schema";
import { ExperimentController } from "./experiment.controller";

describe("ExperimentController", () => {
  let controller: ExperimentController;
  let createExperimentUseCase: CreateExperimentUseCase;
  let getExperimentUseCase: GetExperimentUseCase;
  let listExperimentsUseCase: ListExperimentsUseCase;
  let updateExperimentUseCase: UpdateExperimentUseCase;

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
      controllers: [ExperimentController],
      providers: [
        {
          provide: CreateExperimentUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({ id: UUID.EXPERIMENT }),
          },
        },
        {
          provide: GetExperimentUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue(mockExperiment),
          },
        },
        {
          provide: ListExperimentsUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue([mockExperiment]),
          },
        },
        {
          provide: UpdateExperimentUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        ExperimentFilterPipe,
      ],
    }).compile();

    controller = module.get<ExperimentController>(ExperimentController);
    createExperimentUseCase = module.get<CreateExperimentUseCase>(
      CreateExperimentUseCase,
    );
    getExperimentUseCase =
      module.get<GetExperimentUseCase>(GetExperimentUseCase);
    listExperimentsUseCase = module.get<ListExperimentsUseCase>(
      ListExperimentsUseCase,
    );
    updateExperimentUseCase = module.get<UpdateExperimentUseCase>(
      UpdateExperimentUseCase,
    );

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create an experiment with valid data and pass it to the use case", async () => {
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
      expect(createExperimentUseCase.execute).toHaveBeenCalledWith(
        createDto,
        UUID.USER,
      );
    });
  });

  describe("findAll", () => {
    it("should pass the userId and filter to the list use case with no filter", async () => {
      // Act
      await controller.findAll(UUID.USER);

      // Assert
      expect(listExperimentsUseCase.execute).toHaveBeenCalledWith(
        UUID.USER,
        undefined,
      );
    });

    it("should pass the userId and filter to the list use case with 'my' filter", async () => {
      // Arrange
      const filter: ExperimentFilter = "my";

      // Act
      await controller.findAll(UUID.USER, filter);

      // Assert
      expect(listExperimentsUseCase.execute).toHaveBeenCalledWith(
        UUID.USER,
        filter,
      );
    });

    it("should pass the userId and filter to the list use case with 'member' filter", async () => {
      // Arrange
      const filter: ExperimentFilter = "member";

      // Act
      await controller.findAll(UUID.USER, filter);

      // Assert
      expect(listExperimentsUseCase.execute).toHaveBeenCalledWith(
        UUID.USER,
        filter,
      );
    });

    it("should pass the userId and filter to the list use case with 'related' filter", async () => {
      // Arrange
      const filter: ExperimentFilter = "related";

      // Act
      await controller.findAll(UUID.USER, filter);

      // Assert
      expect(listExperimentsUseCase.execute).toHaveBeenCalledWith(
        UUID.USER,
        filter,
      );
    });
  });

  describe("findOne", () => {
    it("should return experiment data when found", async () => {
      // Act
      const result = await controller.findOne(UUID.EXPERIMENT);

      // Assert
      expect(getExperimentUseCase.execute).toHaveBeenCalledWith(
        UUID.EXPERIMENT,
      );
      expect(result).toEqual(mockExperiment);
    });

    it("should pass through NotFoundExceptions from the use case", async () => {
      // Arrange
      jest
        .spyOn(getExperimentUseCase, "execute")
        .mockRejectedValue(
          new NotFoundException(
            `Experiment with ID ${UUID.EXPERIMENT} not found`,
          ),
        );

      // Act & Assert
      await expect(controller.findOne(UUID.EXPERIMENT)).rejects.toThrow(
        new NotFoundException(
          `Experiment with ID ${UUID.EXPERIMENT} not found`,
        ),
      );
      expect(getExperimentUseCase.execute).toHaveBeenCalledWith(
        UUID.EXPERIMENT,
      );
    });
  });

  describe("update", () => {
    it("should pass update data to the update use case", async () => {
      // Arrange
      const updateDto: UpdateExperimentDto = {
        name: "Updated Experiment",
        status: "active",
      };

      // Act
      await controller.update(UUID.EXPERIMENT, updateDto);

      // Assert
      expect(updateExperimentUseCase.execute).toHaveBeenCalledWith(
        UUID.EXPERIMENT,
        updateDto,
      );
    });

    it("should accept empty update data", async () => {
      // Arrange
      const emptyDto: UpdateExperimentDto = {};

      // Act
      await controller.update(UUID.EXPERIMENT, emptyDto);

      // Assert
      expect(updateExperimentUseCase.execute).toHaveBeenCalledWith(
        UUID.EXPERIMENT,
        emptyDto,
      );
    });

    it("should pass through NotFoundExceptions from the use case", async () => {
      // Arrange
      const updateDto: UpdateExperimentDto = { name: "Will Not Update" };
      jest
        .spyOn(updateExperimentUseCase, "execute")
        .mockRejectedValue(
          new NotFoundException(
            `Experiment with ID ${UUID.EXPERIMENT} not found`,
          ),
        );

      // Act & Assert
      await expect(
        controller.update(UUID.EXPERIMENT, updateDto),
      ).rejects.toThrow(
        new NotFoundException(
          `Experiment with ID ${UUID.EXPERIMENT} not found`,
        ),
      );

      expect(updateExperimentUseCase.execute).toHaveBeenCalledWith(
        UUID.EXPERIMENT,
        updateDto,
      );
    });
  });
});
