import { Injectable, Inject } from "@nestjs/common";

import { eq, and, asc, flowSteps, flowStepConnections } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, AppError, tryCatch, success } from "../../../../common/utils/fp-utils";
import { CreateFlowStepDto, UpdateFlowStepDto, FlowStepDto } from "../models/flow.model";

export class FlowStepRepositoryError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, "FLOW_STEP_REPOSITORY_ERROR", 500, { cause });
  }
}

@Injectable()
export class FlowStepRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async create(
    flowId: string,
    createFlowStepDto: CreateFlowStepDto,
  ): Promise<Result<FlowStepDto[]>> {
    return tryCatch(() =>
      this.database
        .insert(flowSteps)
        .values({
          ...createFlowStepDto,
          flowId,
          // Convert step-specific config to JSONB
          stepSpecification: createFlowStepDto.stepSpecification ?? null,
        })
        .returning(),
    ).then((result) => result.map((rows) => rows as unknown as FlowStepDto[]));
  }

  async findByFlowId(flowId: string) {
    return tryCatch(
      () =>
        this.database
          .select()
          .from(flowSteps)
          .where(eq(flowSteps.flowId, flowId))
          .orderBy(asc(flowSteps.createdAt)), // Order by creation time instead of position
    );
  }

  async findOne(flowId: string, stepId: string): Promise<Result<FlowStepDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(flowSteps)
        .where(and(eq(flowSteps.flowId, flowId), eq(flowSteps.id, stepId)))
        .limit(1);

      return result.length === 0 ? null : (result[0] as unknown as FlowStepDto);
    });
  }

  async update(
    flowId: string,
    stepId: string,
    updateFlowStepDto: UpdateFlowStepDto,
  ): Promise<Result<FlowStepDto[]>> {
    return tryCatch(() =>
      this.database
        .update(flowSteps)
        .set({
          ...updateFlowStepDto,
          // Convert step-specific config to JSONB
          stepSpecification: updateFlowStepDto.stepSpecification ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(flowSteps.flowId, flowId), eq(flowSteps.id, stepId)))
        .returning(),
    ).then((result) => result.map((rows) => rows as unknown as FlowStepDto[]));
  }

  async delete(flowId: string, stepId: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .delete(flowSteps)
        .where(and(eq(flowSteps.flowId, flowId), eq(flowSteps.id, stepId)));
    });
  }

  // Connection management methods
  async createConnection(
    flowId: string,
    sourceStepId: string,
    targetStepId: string,
    connectionData: {
      type?: string;
      animated?: boolean;
      label?: string;
      condition?: any;
      priority?: number;
    } = {},
  ): Promise<Result<any>> {
    return tryCatch(async () => {
      const result = await this.database
        .insert(flowStepConnections)
        .values({
          flowId,
          sourceStepId,
          targetStepId,
          type: connectionData.type ?? "default",
          animated: connectionData.animated ?? false,
          label: connectionData.label,
          condition: connectionData.condition,
          priority: connectionData.priority ?? 0,
        })
        .returning();

      return result[0];
    });
  }

  async getConnections(flowId: string): Promise<Result<any[]>> {
    return tryCatch(() =>
      this.database
        .select()
        .from(flowStepConnections)
        .where(eq(flowStepConnections.flowId, flowId)),
    );
  }

  async deleteConnection(connectionId: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .delete(flowStepConnections)
        .where(eq(flowStepConnections.id, connectionId));
    });
  }

  async getFlowWithConnections(
    flowId: string,
  ): Promise<Result<{ steps: FlowStepDto[]; connections: any[] }>> {
    const stepsResult = await this.findByFlowId(flowId);
    if (stepsResult.isFailure()) {
      return stepsResult;
    }

    const connectionsResult = await this.getConnections(flowId);
    if (connectionsResult.isFailure()) {
      return connectionsResult;
    }

    return success({
      steps: stepsResult.value as unknown as FlowStepDto[],
      connections: connectionsResult.value,
    });
  }

  // Mobile-specific method: Get flow as sequential execution format
  async getMobileFlowExecution(flowId: string): Promise<
    Result<{
      flowId: string;
      steps: {
        id: string;
        type: "INSTRUCTION" | "QUESTION" | "MEASUREMENT" | "ANALYSIS";
        title?: string;
        description?: string;
        media?: string[];
        stepSpecification?: Record<string, unknown>;
        nextStepIds: string[];
        isStartStep: boolean;
        isEndStep: boolean;
      }[];
      startStepId?: string;
    }>
  > {
    const flowWithConnectionsResult = await this.getFlowWithConnections(flowId);

    return flowWithConnectionsResult.map(({ steps, connections }) => {
      // Build adjacency map from connections
      const adjacencyMap = new Map<string, string[]>();
      const incomingMap = new Map<string, string[]>();

      connections.forEach((conn: any) => {
        if (!adjacencyMap.has(conn.sourceStepId)) {
          adjacencyMap.set(conn.sourceStepId, []);
        }
        adjacencyMap.get(conn.sourceStepId)!.push(conn.targetStepId);

        if (!incomingMap.has(conn.targetStepId)) {
          incomingMap.set(conn.targetStepId, []);
        }
        incomingMap.get(conn.targetStepId)!.push(conn.sourceStepId);
      });

      // Find start step (no incoming connections or marked as start)
      const startStep = steps.find(
        (step: any) =>
          step.isStartNode ?? !incomingMap.has(step.id) ?? incomingMap.get(step.id)!.length === 0,
      );

      // Convert to mobile format
      const mobileSteps = steps.map((step: any) => ({
        id: step.id,
        type: step.type,
        title: step.title ?? undefined,
        description: step.description ?? undefined,
        media: (step.media as string[]) ?? undefined,
        stepSpecification: step.stepSpecification as Record<string, unknown> | undefined,
        nextStepIds: adjacencyMap.get(step.id) ?? [],
        isStartStep: step.isStartNode ?? step.id === startStep?.id,
        isEndStep:
          step.isEndNode ?? !adjacencyMap.has(step.id) ?? adjacencyMap.get(step.id)!.length === 0,
      }));

      return {
        flowId,
        steps: mobileSteps,
        startStepId: startStep?.id,
      };
    });
  }
}
