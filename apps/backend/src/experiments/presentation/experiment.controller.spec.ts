import { NotFoundException, ForbiddenException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { fromPartial } from "@total-typescript/shoehorn";

import { ExperimentFilterPipe } from "./application/pipes/experiment-filter.pipe";
import type { ExperimentFilter } from "./application/pipes/experiment-filter.pipe";
import { AddExperimentMemberUseCase } from "./application/use-cases/add-experiment-member.use-case";
import { CreateExperimentUseCase } from "./application/use-cases/create-experiment.use-case";
import { DeleteExperimentUseCase } from "./application/use-cases/delete-experiment.use-case";
import { GetExperimentUseCase } from "./application/use-cases/get-experiment.use-case";
import { ListExperimentMembersUseCase } from "./application/use-cases/list-experiment-members.use-case";
import { ListExperimentsUseCase } from "./application/use-cases/list-experiments.use-case";
import { RemoveExperimentMemberUseCase } from "./application/use-cases/remove-experiment-member.use-case";
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
  let deleteExperimentUseCase: DeleteExperimentUseCase;
  let addExperimentMemberUseCase: AddExperimentMemberUseCase;
  let removeExperimentMemberUseCase: RemoveExperimentMemberUseCase;
  let listExperimentMembersUseCase: ListExperimentMembersUseCase;

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
        {
          provide: DeleteExperimentUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AddExperimentMemberUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({
              id: "member-id",
              experimentId: UUID.EXPERIMENT,
              userId: UUID.USER,
              role: "member",
            }),
          },
        },
        {
          provide: RemoveExperimentMemberUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ListExperimentMembersUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue([
              {
                id: "member-id",
                userId: UUID.USER,
                role: "member",
                joinedAt: new Date(),
              },
            ]),
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
    deleteExperimentUseCase = module.get<DeleteExperimentUseCase>(
      DeleteExperimentUseCase,
    );
    addExperimentMemberUseCase = module.get<AddExperimentMemberUseCase>(
      AddExperimentMemberUseCase,
    );
    removeExperimentMemberUseCase = module.get<RemoveExperimentMemberUseCase>(
      RemoveExperimentMemberUseCase,
    );
    listExperimentMembersUseCase = module.get<ListExperimentMembersUseCase>(
      ListExperimentMembersUseCase,
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

  describe("remove", () => {
    it("should call the delete use case with correct params", async () => {
      // Act
      await controller.remove(UUID.EXPERIMENT, UUID.USER);

      // Assert
      expect(deleteExperimentUseCase.execute).toHaveBeenCalledWith(
        UUID.EXPERIMENT,
        UUID.USER,
      );
    });

    it("should pass through NotFoundExceptions from the use case", async () => {
      // Arrange
      jest
        .spyOn(deleteExperimentUseCase, "execute")
        .mockRejectedValue(
          new NotFoundException(
            `Experiment with ID ${UUID.EXPERIMENT} not found`,
          ),
        );

      // Act & Assert
      await expect(
        controller.remove(UUID.EXPERIMENT, UUID.USER),
      ).rejects.toThrow(
        new NotFoundException(
          `Experiment with ID ${UUID.EXPERIMENT} not found`,
        ),
      );
    });

    it("should pass through ForbiddenExceptions from the use case", async () => {
      // Arrange
      jest
        .spyOn(deleteExperimentUseCase, "execute")
        .mockRejectedValue(
          new ForbiddenException(`Only the creator can delete this experiment`),
        );

      // Act & Assert
      await expect(
        controller.remove(UUID.EXPERIMENT, UUID.USER),
      ).rejects.toThrow(
        new ForbiddenException(`Only the creator can delete this experiment`),
      );
    });
  });

  describe("getMembers", () => {
    it("should call the list members use case with correct params", async () => {
      // Act
      await controller.getMembers(UUID.EXPERIMENT, UUID.USER);

      // Assert
      expect(listExperimentMembersUseCase.execute).toHaveBeenCalledWith(
        UUID.EXPERIMENT,
        UUID.USER,
      );
    });
  });

  describe("addMember", () => {
    it("should call the add member use case with correct params", async () => {
      // Arrange
      const addMemberDto = { userId: "new-member-id", role: "admin" as const };

      // Act
      await controller.addMember(UUID.EXPERIMENT, addMemberDto, UUID.USER);

      // Assert
      expect(addExperimentMemberUseCase.execute).toHaveBeenCalledWith(
        UUID.EXPERIMENT,
        addMemberDto,
        UUID.USER,
      );
    });
  });

  describe("removeMember", () => {
    it("should call the remove member use case with correct params", async () => {
      // Arrange
      const memberId = "member-to-remove-id";

      // Act
      await controller.removeMember(UUID.EXPERIMENT, memberId, UUID.USER);

      // Assert
      expect(removeExperimentMemberUseCase.execute).toHaveBeenCalledWith(
        UUID.EXPERIMENT,
        memberId,
        UUID.USER,
      );
    });
  });
});
