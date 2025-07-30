import { Test } from "@nestjs/testing";

import { success, failure, AppError } from "../../../../../common/utils/fp-utils";
import type { CreateFlowWithStepsDto, FlowWithGraphDto } from "../../../core/models/flow.model";
import { FlowStepRepository } from "../../../core/repositories/flow-step.repository";
import { CreateFlowWithStepsUseCase } from "./create-flow-with-steps";

describe("CreateFlowWithStepsUseCase", () => {
  let useCase: CreateFlowWithStepsUseCase;
  let mockFlowStepRepository: jest.Mocked<FlowStepRepository>;

  const mockUserId = "550e8400-e29b-41d4-a716-446655440000";
  const mockFlowId = "550e8400-e29b-41d4-a716-446655440001";
  const mockStepId1 = "550e8400-e29b-41d4-a716-446655440002";
  const mockStepId2 = "550e8400-e29b-41d4-a716-446655440003";
  const mockConnectionId = "550e8400-e29b-41d4-a716-446655440004";

  beforeEach(async () => {
    const mockRepository = {
      createFlowWithSteps: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        CreateFlowWithStepsUseCase,
        {
          provide: FlowStepRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    useCase = module.get<CreateFlowWithStepsUseCase>(CreateFlowWithStepsUseCase);
    mockFlowStepRepository = module.get(FlowStepRepository);
  });

  describe("execute", () => {
    it("should successfully create flow with steps and connections", async () => {
      // Arrange
      const createFlowWithStepsDto: CreateFlowWithStepsDto = {
        name: "Test Flow",
        description: "A test flow with steps",
        version: 1,
        isActive: true,
        steps: [
          {
            type: "INSTRUCTION",
            title: "Step 1",
            description: "First step",
            position: { x: 100, y: 100 },
            isStartNode: true,
            isEndNode: false,
            stepSpecification: {},
          },
          {
            type: "QUESTION",
            title: "Step 2",
            description: "Second step",
            position: { x: 200, y: 200 },
            isStartNode: false,
            isEndNode: true,
            stepSpecification: {
              required: true,
              answerType: "TEXT",
            },
          },
        ],
        connections: [
          {
            sourceStepId: mockStepId1,
            targetStepId: mockStepId2,
            type: "default",
            animated: false,
            priority: 0,
          },
        ],
      };

      const expectedResult: FlowWithGraphDto = {
        id: mockFlowId,
        name: "Test Flow",
        description: "A test flow with steps",
        version: 1,
        isActive: true,
        createdBy: mockUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        steps: [
          {
            id: mockStepId1,
            flowId: mockFlowId,
            type: "INSTRUCTION",
            title: "Step 1",
            description: "First step",
            media: null,
            position: { x: 100, y: 100 },
            size: null,
            isStartNode: true,
            isEndNode: false,
            stepSpecification: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: mockStepId2,
            flowId: mockFlowId,
            type: "QUESTION",
            title: "Step 2",
            description: "Second step",
            media: null,
            position: { x: 200, y: 200 },
            size: null,
            isStartNode: false,
            isEndNode: true,
            stepSpecification: {
              required: true,
              answerType: "TEXT",
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        connections: [
          {
            id: mockConnectionId,
            flowId: mockFlowId,
            sourceStepId: mockStepId1,
            targetStepId: mockStepId2,
            type: "default",
            animated: false,
            label: null,
            condition: null,
            priority: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      mockFlowStepRepository.createFlowWithSteps.mockResolvedValue(success(expectedResult));

      // Act
      const result = await useCase.execute(createFlowWithStepsDto, mockUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      expect(result.value).toEqual(expectedResult);
      expect(mockFlowStepRepository.createFlowWithSteps).toHaveBeenCalledWith(
        createFlowWithStepsDto,
        mockUserId,
      );
      expect(mockFlowStepRepository.createFlowWithSteps).toHaveBeenCalledTimes(1);
    });

    it("should return failure when repository fails", async () => {
      // Arrange
      const createFlowWithStepsDto: CreateFlowWithStepsDto = {
        name: "Test Flow",
        description: "A test flow",
        steps: [],
      };

      const expectedError = AppError.internal("Database error");
      mockFlowStepRepository.createFlowWithSteps.mockResolvedValue(failure(expectedError));

      // Act
      const result = await useCase.execute(createFlowWithStepsDto, mockUserId);

      // Assert
      expect(result.isFailure()).toBe(true);
      expect(result.error).toEqual(expectedError);
      expect(mockFlowStepRepository.createFlowWithSteps).toHaveBeenCalledWith(
        createFlowWithStepsDto,
        mockUserId,
      );
    });

    it("should handle flow creation without connections", async () => {
      // Arrange
      const createFlowWithStepsDto: CreateFlowWithStepsDto = {
        name: "Simple Flow",
        description: "A flow without connections",
        steps: [
          {
            type: "INSTRUCTION",
            title: "Only Step",
            position: { x: 100, y: 100 },
            isStartNode: true,
            isEndNode: true,
          },
        ],
      };

      const expectedResult: FlowWithGraphDto = {
        id: mockFlowId,
        name: "Simple Flow",
        description: "A flow without connections",
        version: 1,
        isActive: true,
        createdBy: mockUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        steps: [
          {
            id: mockStepId1,
            flowId: mockFlowId,
            type: "INSTRUCTION",
            title: "Only Step",
            description: null,
            media: null,
            position: { x: 100, y: 100 },
            size: null,
            isStartNode: true,
            isEndNode: true,
            stepSpecification: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        connections: [],
      };

      mockFlowStepRepository.createFlowWithSteps.mockResolvedValue(success(expectedResult));

      // Act
      const result = await useCase.execute(createFlowWithStepsDto, mockUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      expect(result.value).toEqual(expectedResult);
      expect(result.value.connections).toHaveLength(0);
    });

    it("should handle different step types correctly", async () => {
      // Arrange
      const createFlowWithStepsDto: CreateFlowWithStepsDto = {
        name: "Multi-Step Flow",
        steps: [
          {
            type: "INSTRUCTION",
            title: "Instruction Step",
            position: { x: 0, y: 0 },
            stepSpecification: {},
          },
          {
            type: "QUESTION",
            title: "Question Step",
            position: { x: 100, y: 0 },
            stepSpecification: {
              required: true,
              answerType: "SELECT",
              options: ["Option 1", "Option 2"],
            },
          },
          {
            type: "MEASUREMENT",
            title: "Measurement Step",
            position: { x: 200, y: 0 },
            stepSpecification: {
              protocolId: "proto-123",
              autoStart: true,
              timeoutSeconds: 300,
            },
          },
          {
            type: "ANALYSIS",
            title: "Analysis Step",
            position: { x: 300, y: 0 },
            stepSpecification: {
              macroId: "macro-456",
              autoRun: false,
              visualizationType: "chart",
            },
          },
        ],
      };

      const expectedResult: FlowWithGraphDto = {
        id: mockFlowId,
        name: "Multi-Step Flow",
        description: null,
        version: 1,
        isActive: true,
        createdBy: mockUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        steps: createFlowWithStepsDto.steps.map((step, index) => ({
          id: `step-${index}`,
          flowId: mockFlowId,
          ...step,
          description: null,
          media: null,
          size: null,
          isStartNode: index === 0,
          isEndNode: index === createFlowWithStepsDto.steps.length - 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
        connections: [],
      };

      mockFlowStepRepository.createFlowWithSteps.mockResolvedValue(success(expectedResult));

      // Act
      const result = await useCase.execute(createFlowWithStepsDto, mockUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      expect(result.value.steps).toHaveLength(4);
      expect(result.value.steps[0].type).toBe("INSTRUCTION");
      expect(result.value.steps[1].type).toBe("QUESTION");
      expect(result.value.steps[2].type).toBe("MEASUREMENT");
      expect(result.value.steps[3].type).toBe("ANALYSIS");
    });
  });
});
