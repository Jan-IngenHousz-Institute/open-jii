import { Test } from "@nestjs/testing";

import { success, failure, AppError } from "../../../../../common/utils/fp-utils";
import type { UpdateFlowWithStepsDto, FlowWithGraphDto } from "../../../core/models/flow.model";
import { FlowStepRepository } from "../../../core/repositories/flow-step.repository";
import { UpdateFlowWithStepsUseCase } from "./update-flow-with-steps";

describe("UpdateFlowWithStepsUseCase", () => {
  let useCase: UpdateFlowWithStepsUseCase;
  let mockFlowStepRepository: jest.Mocked<FlowStepRepository>;

  const mockFlowId = "550e8400-e29b-41d4-a716-446655440001";
  const mockStepId1 = "550e8400-e29b-41d4-a716-446655440002";
  const mockStepId2 = "550e8400-e29b-41d4-a716-446655440003";
  const mockStepId3 = "550e8400-e29b-41d4-a716-446655440004";
  const mockConnectionId = "550e8400-e29b-41d4-a716-446655440005";

  beforeEach(async () => {
    const mockRepository = {
      updateFlowWithSteps: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        UpdateFlowWithStepsUseCase,
        {
          provide: FlowStepRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    useCase = module.get<UpdateFlowWithStepsUseCase>(UpdateFlowWithStepsUseCase);
    mockFlowStepRepository = module.get(FlowStepRepository);
  });

  describe("execute", () => {
    it("should successfully update flow with bulk step operations", async () => {
      // Arrange
      const updateFlowWithStepsDto: UpdateFlowWithStepsDto = {
        flow: {
          name: "Updated Flow Name",
          description: "Updated description",
        },
        steps: {
          create: [
            {
              type: "INSTRUCTION",
              title: "New Step",
              position: { x: 300, y: 300 },
              stepSpecification: {},
            },
          ],
          update: [
            {
              id: mockStepId1,
              title: "Updated Step Title",
              description: "Updated description",
            },
          ],
          delete: [mockStepId2],
        },
        connections: {
          create: [
            {
              sourceStepId: mockStepId1,
              targetStepId: mockStepId3,
              type: "default",
            },
          ],
          delete: [mockConnectionId],
        },
      };

      const expectedResult: FlowWithGraphDto = {
        id: mockFlowId,
        name: "Updated Flow Name",
        description: "Updated description",
        version: 1,
        isActive: true,
        createdBy: "user-123",
        createdAt: new Date(),
        updatedAt: new Date(),
        steps: [
          {
            id: mockStepId1,
            flowId: mockFlowId,
            type: "INSTRUCTION",
            title: "Updated Step Title",
            description: "Updated description",
            media: null,
            position: { x: 100, y: 100 },
            size: null,
            isStartNode: true,
            isEndNode: false,
            stepSpecification: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: mockStepId3,
            flowId: mockFlowId,
            type: "INSTRUCTION",
            title: "New Step",
            description: null,
            media: null,
            position: { x: 300, y: 300 },
            size: null,
            isStartNode: false,
            isEndNode: true,
            stepSpecification: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        connections: [
          {
            id: "new-connection-id",
            flowId: mockFlowId,
            sourceStepId: mockStepId1,
            targetStepId: mockStepId3,
            type: "default",
            animated: false,
            label: null,
            condition: null,
            priority: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockFlowStepRepository.updateFlowWithSteps.mockResolvedValue(success(expectedResult));

      // Act
      const result = await useCase.execute(mockFlowId, updateFlowWithStepsDto);

      // Assert
      expect(result.isSuccess()).toBe(true);
      expect(result.value).toEqual(expectedResult);
      expect(mockFlowStepRepository.updateFlowWithSteps).toHaveBeenCalledWith(
        mockFlowId,
        updateFlowWithStepsDto,
      );
      expect(mockFlowStepRepository.updateFlowWithSteps).toHaveBeenCalledTimes(1);
    });

    it("should return failure when repository fails", async () => {
      // Arrange
      const updateFlowWithStepsDto: UpdateFlowWithStepsDto = {
        flow: {
          name: "Updated Flow",
        },
      };

      const expectedError = AppError.notFound("Flow not found");
      mockFlowStepRepository.updateFlowWithSteps.mockResolvedValue(failure(expectedError));

      // Act
      const result = await useCase.execute(mockFlowId, updateFlowWithStepsDto);

      // Assert
      expect(result.isFailure()).toBe(true);
      expect(result.error).toEqual(expectedError);
      expect(mockFlowStepRepository.updateFlowWithSteps).toHaveBeenCalledWith(
        mockFlowId,
        updateFlowWithStepsDto,
      );
    });

    it("should handle partial updates correctly", async () => {
      // Arrange - Only updating flow metadata
      const updateFlowWithStepsDto: UpdateFlowWithStepsDto = {
        flow: {
          name: "New Flow Name",
          isActive: false,
        },
      };

      const expectedResult: FlowWithGraphDto = {
        id: mockFlowId,
        name: "New Flow Name",
        description: "Original description",
        version: 1,
        isActive: false,
        createdBy: "user-123",
        createdAt: new Date(),
        updatedAt: new Date(),
        steps: [],
        connections: [],
      };

      mockFlowStepRepository.updateFlowWithSteps.mockResolvedValue(success(expectedResult));

      // Act
      const result = await useCase.execute(mockFlowId, updateFlowWithStepsDto);

      // Assert
      expect(result.isSuccess()).toBe(true);
      expect(result.value.name).toBe("New Flow Name");
      expect(result.value.isActive).toBe(false);
    });

    it("should handle step-only updates", async () => {
      // Arrange - Only updating steps
      const updateFlowWithStepsDto: UpdateFlowWithStepsDto = {
        steps: {
          create: [
            {
              type: "QUESTION",
              title: "New Question",
              position: { x: 400, y: 400 },
              stepSpecification: {
                required: true,
                answerType: "NUMBER",
              },
            },
          ],
          update: [
            {
              id: mockStepId1,
              position: { x: 150, y: 150 },
            },
          ],
        },
      };

      const expectedResult: FlowWithGraphDto = {
        id: mockFlowId,
        name: "Original Flow Name",
        description: "Original description",
        version: 1,
        isActive: true,
        createdBy: "user-123",
        createdAt: new Date(),
        updatedAt: new Date(),
        steps: [
          {
            id: mockStepId1,
            flowId: mockFlowId,
            type: "INSTRUCTION",
            title: "Original Title",
            description: null,
            media: null,
            position: { x: 150, y: 150 },
            size: null,
            isStartNode: true,
            isEndNode: false,
            stepSpecification: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "new-step-id",
            flowId: mockFlowId,
            type: "QUESTION",
            title: "New Question",
            description: null,
            media: null,
            position: { x: 400, y: 400 },
            size: null,
            isStartNode: false,
            isEndNode: true,
            stepSpecification: {
              required: true,
              answerType: "NUMBER",
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        connections: [],
      };

      mockFlowStepRepository.updateFlowWithSteps.mockResolvedValue(success(expectedResult));

      // Act
      const result = await useCase.execute(mockFlowId, updateFlowWithStepsDto);

      // Assert
      expect(result.isSuccess()).toBe(true);
      expect(result.value.steps).toHaveLength(2);
      expect(result.value.steps[0].position).toEqual({ x: 150, y: 150 });
      expect(result.value.steps[1].type).toBe("QUESTION");
    });

    it("should handle connection-only updates", async () => {
      // Arrange - Only updating connections
      const updateFlowWithStepsDto: UpdateFlowWithStepsDto = {
        connections: {
          create: [
            {
              sourceStepId: mockStepId1,
              targetStepId: mockStepId2,
              type: "default",
              label: "New Connection",
            },
          ],
          update: [
            {
              id: mockConnectionId,
              label: "Updated Connection Label",
              priority: 1,
            },
          ],
        },
      };

      const expectedResult: FlowWithGraphDto = {
        id: mockFlowId,
        name: "Flow Name",
        description: null,
        version: 1,
        isActive: true,
        createdBy: "user-123",
        createdAt: new Date(),
        updatedAt: new Date(),
        steps: [],
        connections: [
          {
            id: mockConnectionId,
            flowId: mockFlowId,
            sourceStepId: mockStepId1,
            targetStepId: mockStepId2,
            type: "default",
            animated: false,
            label: "Updated Connection Label",
            condition: null,
            priority: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "new-conn-id",
            flowId: mockFlowId,
            sourceStepId: mockStepId1,
            targetStepId: mockStepId2,
            type: "default",
            animated: false,
            label: "New Connection",
            condition: null,
            priority: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      mockFlowStepRepository.updateFlowWithSteps.mockResolvedValue(success(expectedResult));

      // Act
      const result = await useCase.execute(mockFlowId, updateFlowWithStepsDto);

      // Assert
      expect(result.isSuccess()).toBe(true);
      expect(result.value.connections).toHaveLength(2);
      expect(result.value.connections[0].label).toBe("Updated Connection Label");
      expect(result.value.connections[1].label).toBe("New Connection");
    });

    it("should handle empty update gracefully", async () => {
      // Arrange - Empty update
      const updateFlowWithStepsDto: UpdateFlowWithStepsDto = {};

      const expectedResult: FlowWithGraphDto = {
        id: mockFlowId,
        name: "Unchanged Flow",
        description: null,
        version: 1,
        isActive: true,
        createdBy: "user-123",
        createdAt: new Date(),
        updatedAt: new Date(),
        steps: [],
        connections: [],
      };

      mockFlowStepRepository.updateFlowWithSteps.mockResolvedValue(success(expectedResult));

      // Act
      const result = await useCase.execute(mockFlowId, updateFlowWithStepsDto);

      // Assert
      expect(result.isSuccess()).toBe(true);
      expect(result.value).toEqual(expectedResult);
    });
  });
});
