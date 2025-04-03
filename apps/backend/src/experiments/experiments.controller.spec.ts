import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";

import { ExperimentsController } from "./experiments.controller";
import { ExperimentsService } from "./experiments.service";
import { ExperimentFilterPipe } from "./pipes/experiment-filter.pipe";
import type { ExperimentFilter } from "./pipes/experiment-filter.pipe";
import type {
  CreateExperimentDto,
  UpdateExperimentDto,
} from "./schemas/experiment.schema";
import {
  createExperimentSchema,
  updateExperimentSchema,
} from "./schemas/experiment.schema";

describe("ExperimentsController", () => {
  let controller: ExperimentsController;
  let service: ExperimentsService;
  const validUserId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExperimentsController],
      providers: [
        {
          provide: ExperimentsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        ExperimentFilterPipe,
      ],
    }).compile();

    controller = module.get<ExperimentsController>(ExperimentsController);
    service = module.get<ExperimentsService>(ExperimentsService);
  });

  describe("create", () => {
    describe("validation", () => {
      it("should reject when required fields are missing", () => {
        const invalidDto = {
          name: "test",
          // missing required fields
        };

        const result = createExperimentSchema.safeParse(invalidDto);
        expect(result.success).toBe(false);
      });

      it("should reject invalid enum values", () => {
        const invalidDto = {
          name: "test",
          status: "invalid_status",
          visibility: "invalid_visibility",
          embargoIntervalDays: 90,
          createdBy: validUserId,
        };

        const result = createExperimentSchema.safeParse(invalidDto);
        expect(result.success).toBe(false);
      });

      it("should reject invalid number types", () => {
        const invalidDto = {
          name: "test",
          status: "provisioning",
          visibility: "private",
          embargoIntervalDays: "not-a-number",
          createdBy: validUserId,
        };

        const result = createExperimentSchema.safeParse(invalidDto);
        expect(result.success).toBe(false);
      });

      it("should accept valid data", () => {
        const validDto = {
          name: "test",
          status: "provisioning",
          visibility: "private",
          embargoIntervalDays: 90,
          createdBy: validUserId,
        };

        const result = createExperimentSchema.safeParse(validDto);
        expect(result.success).toBe(true);
      });
    });

    it("should create an experiment with valid data", async () => {
      const createDto: CreateExperimentDto = {
        name: "test",
        status: "provisioning",
        visibility: "private",
        embargoIntervalDays: 90,
        createdBy: validUserId,
      };

      await controller.create(createDto, validUserId);
      expect(service.create).toHaveBeenCalledWith(createDto, validUserId);
    });
  });

  describe("findAll", () => {
    it("should find all experiments with valid filters", async () => {
      const validFilters: ExperimentFilter[] = [
        "my",
        "member",
        "related",
        undefined,
      ];

      for (const filter of validFilters) {
        await controller.findAll(validUserId, filter);
        expect(service.findAll).toHaveBeenCalledWith(validUserId, filter);
      }
    });

    it("should reject invalid filter values", async () => {
      const filterPipe = new ExperimentFilterPipe();
      await expect(async () => {
        await filterPipe.transform("invalid_filter");
      }).rejects.toThrow(BadRequestException);
      expect(service.findAll).not.toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    it("should find one experiment by valid id", async () => {
      const id = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
      await controller.findOne(id);
      expect(service.findOne).toHaveBeenCalledWith(id);
    });
  });

  describe("update", () => {
    describe("validation", () => {
      it("should reject invalid enum values", () => {
        const invalidDto = {
          status: "invalid_status",
        };

        const result = updateExperimentSchema.safeParse(invalidDto);
        expect(result.success).toBe(false);
      });

      it("should reject invalid number types", () => {
        const invalidDto = {
          embargoIntervalDays: "not-a-number",
        };

        const result = updateExperimentSchema.safeParse(invalidDto);
        expect(result.success).toBe(false);
      });

      it("should accept valid partial data", () => {
        const validDto = {
          name: "updated",
          status: "active",
        };

        const result = updateExperimentSchema.safeParse(validDto);
        expect(result.success).toBe(true);
      });

      it("should accept empty data", () => {
        const emptyDto = {};

        const result = updateExperimentSchema.safeParse(emptyDto);
        expect(result.success).toBe(true);
      });
    });

    it("should update with valid partial data", async () => {
      const updateDto: UpdateExperimentDto = {
        name: "updated",
        status: "active",
      };

      await controller.update(
        "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        updateDto,
      );
      expect(service.update).toHaveBeenCalledWith(
        "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        updateDto,
      );
    });

    it("should update with empty data", async () => {
      const emptyDto: UpdateExperimentDto = {};

      await controller.update("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", emptyDto);
      expect(service.update).toHaveBeenCalledWith(
        "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        emptyDto,
      );
    });
  });
});
