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
  const validUserId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const validExperimentId = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExperimentsController],
      providers: [
        {
          provide: ExperimentsService,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: validExperimentId }),
            findAll: jest.fn().mockResolvedValue([{ id: validExperimentId }]),
            findOne: jest.fn().mockResolvedValue({ id: validExperimentId }),
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
      const createDto: CreateExperimentDto = {
        name: "Test Experiment",
        status: "provisioning",
        createdBy: validUserId,
        visibility: "private",
        embargoIntervalDays: 90,
      };

      await controller.create(createDto, validUserId);

      expect(service.create).toHaveBeenCalledTimes(1);
      expect(service.create).toHaveBeenCalledWith(createDto, validUserId);
    });
  });

  describe("findAll", () => {
    it("should pass the userId and filter to the service with no filter", async () => {
      await controller.findAll(validUserId);

      expect(service.findAll).toHaveBeenCalledTimes(1);
      expect(service.findAll).toHaveBeenCalledWith(validUserId, undefined);
    });

    it("should pass the userId and filter to the service with 'my' filter", async () => {
      const filter: ExperimentFilter = "my";

      await controller.findAll(validUserId, filter);

      expect(service.findAll).toHaveBeenCalledTimes(1);
      expect(service.findAll).toHaveBeenCalledWith(validUserId, filter);
    });

    it("should pass the userId and filter to the service with 'member' filter", async () => {
      const filter: ExperimentFilter = "member";

      await controller.findAll(validUserId, filter);

      expect(service.findAll).toHaveBeenCalledTimes(1);
      expect(service.findAll).toHaveBeenCalledWith(validUserId, filter);
    });

    it("should pass the userId and filter to the service with 'related' filter", async () => {
      const filter: ExperimentFilter = "related";

      await controller.findAll(validUserId, filter);

      expect(service.findAll).toHaveBeenCalledTimes(1);
      expect(service.findAll).toHaveBeenCalledWith(validUserId, filter);
    });
  });

  describe("findOne", () => {
    it("should return experiment data when found", async () => {
      const mockExperiment = { id: validExperimentId, name: "Test Experiment" };
      jest
        .spyOn(service, "findOne")
        .mockResolvedValue(fromPartial(mockExperiment));

      const result = await controller.findOne(validExperimentId);

      expect(service.findOne).toHaveBeenCalledTimes(1);
      expect(service.findOne).toHaveBeenCalledWith(validExperimentId);
      expect(result).toEqual(mockExperiment);
    });

    it("should throw NotFoundException when experiment is not found", async () => {
      jest.spyOn(service, "findOne").mockResolvedValue(null);

      await expect(controller.findOne(validExperimentId)).rejects.toThrow(
        new NotFoundException(
          `Experiment with ID ${validExperimentId} not found`,
        ),
      );

      expect(service.findOne).toHaveBeenCalledTimes(1);
      expect(service.findOne).toHaveBeenCalledWith(validExperimentId);
    });
  });

  describe("update", () => {
    it("should pass update data to service when experiment exists", async () => {
      const updateDto: UpdateExperimentDto = {
        name: "Updated Experiment",
        status: "active",
      };
      const mockExperiment = {
        id: validExperimentId,
        name: "Original Experiment",
      };

      jest
        .spyOn(service, "findOne")
        .mockResolvedValue(fromPartial(mockExperiment));

      await controller.update(validExperimentId, updateDto);

      expect(service.findOne).toHaveBeenCalledTimes(1);
      expect(service.findOne).toHaveBeenCalledWith(validExperimentId);
      expect(service.update).toHaveBeenCalledTimes(1);
      expect(service.update).toHaveBeenCalledWith(validExperimentId, updateDto);
    });

    it("should accept empty update data", async () => {
      const emptyDto: UpdateExperimentDto = {};
      const mockExperiment = {
        id: validExperimentId,
        name: "Original Experiment",
      };

      jest
        .spyOn(service, "findOne")
        .mockResolvedValue(fromPartial(mockExperiment));

      await controller.update(validExperimentId, emptyDto);

      expect(service.findOne).toHaveBeenCalledTimes(1);
      expect(service.update).toHaveBeenCalledTimes(1);
      expect(service.update).toHaveBeenCalledWith(validExperimentId, emptyDto);
    });

    it("should throw NotFoundException when trying to update non-existent experiment", async () => {
      const updateDto: UpdateExperimentDto = { name: "Will Not Update" };

      jest.spyOn(service, "findOne").mockResolvedValue(null);

      await expect(
        controller.update(validExperimentId, updateDto),
      ).rejects.toThrow(
        new NotFoundException(
          `Experiment with ID ${validExperimentId} not found`,
        ),
      );

      expect(service.findOne).toHaveBeenCalledTimes(1);
      expect(service.findOne).toHaveBeenCalledWith(validExperimentId);
      expect(service.update).not.toHaveBeenCalled();
    });
  });
});
