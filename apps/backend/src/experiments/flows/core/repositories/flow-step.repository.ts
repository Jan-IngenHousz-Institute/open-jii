import { Injectable, Inject } from "@nestjs/common";

import { eq, and, asc, inArray, flows, flowSteps, flowStepConnections } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, AppError, tryCatch, success } from "../../../../common/utils/fp-utils";
import {
  CreateFlowStepDto,
  UpdateFlowStepDto,
  FlowStepDto,
  CreateFlowWithStepsDto,
  UpdateFlowWithStepsDto,
  FlowWithGraphDto,
  FlowStepConnectionDto,
} from "../models/flow.model";

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

  async create(flowId: string, createFlowStepDto: CreateFlowStepDto) {
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
    );
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

  async update(flowId: string, stepId: string, updateFlowStepDto: UpdateFlowStepDto) {
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
    );
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
  ) {
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

  // Bulk operations for React Flow frontend integration
  async createFlowWithSteps(createFlowWithStepsDto: CreateFlowWithStepsDto, userId: string) {
    return tryCatch(async () => {
      return await this.database.transaction(async (tx) => {
        // 1. Create the flow
        const [flow] = await tx
          .insert(flows)
          .values({
            name: createFlowWithStepsDto.name,
            description: createFlowWithStepsDto.description,
            version: createFlowWithStepsDto.version ?? 1,
            isActive: createFlowWithStepsDto.isActive ?? true,
            createdBy: userId,
          })
          .returning();

        // 2. Create all steps with temporary ID mapping
        const createdSteps = await tx
          .insert(flowSteps)
          .values(
            createFlowWithStepsDto.steps.map((step) => ({
              ...step,
              flowId: flow.id,
              stepSpecification: step.stepSpecification ?? null,
            })),
          )
          .returning();

        // 3. Create connections if provided, mapping temporary step IDs to real ones
        let createdConnections = [];
        if (createFlowWithStepsDto.connections && createFlowWithStepsDto.connections.length > 0) {
          // Create a mapping from temporary step IDs (like "temp-step-1") to real step IDs
          const stepIdMap = new Map<string, string>();
          createFlowWithStepsDto.steps.forEach((step, index) => {
            // Map temp-step-1, temp-step-2, etc. to actual step IDs
            stepIdMap.set(`temp-step-${index + 1}`, createdSteps[index].id);
            // Also map any custom step IDs that might be in the step data
            if ("id" in step && typeof step.id === "string" && step.id.startsWith("temp-")) {
              stepIdMap.set(step.id, createdSteps[index].id);
            }
          });

          createdConnections = await tx
            .insert(flowStepConnections)
            .values(
              createFlowWithStepsDto.connections.map((conn) => ({
                ...conn,
                flowId: flow.id,
                sourceStepId: stepIdMap.get(conn.sourceStepId) ?? conn.sourceStepId,
                targetStepId: stepIdMap.get(conn.targetStepId) ?? conn.targetStepId,
                type: conn.type ?? "default",
                animated: conn.animated ?? false,
                priority: conn.priority ?? 0,
              })),
            )
            .returning();
        }

        return {
          ...flow,
          steps: createdSteps,
          connections: createdConnections,
        };
      });
    });
  }

  async updateFlowWithSteps(flowId: string, updateFlowWithStepsDto: UpdateFlowWithStepsDto) {
    return tryCatch(async () => {
      return this.database.transaction(async (tx) => {
        let updatedFlow;

        // 1. Update flow if provided
        if (updateFlowWithStepsDto.flow) {
          const updatedFlows = await tx
            .update(flows)
            .set({
              ...updateFlowWithStepsDto.flow,
              updatedAt: new Date(),
            })
            .where(eq(flows.id, flowId))
            .returning();

          if (updatedFlows.length === 0) {
            throw AppError.notFound("Flow not found");
          }

          updatedFlow = updatedFlows[0];
        } else {
          // Get existing flow
          const existingFlows = await tx.select().from(flows).where(eq(flows.id, flowId)).limit(1);

          if (existingFlows.length === 0) {
            throw AppError.notFound("Flow not found");
          }

          updatedFlow = existingFlows[0];
        }

        // 2. Handle step operations
        // Initialize step ID mapping for placeholder IDs like "new-step-id"
        const stepIdMap = new Map<string, string>();

        if (updateFlowWithStepsDto.steps) {
          // Delete steps if specified
          if (
            updateFlowWithStepsDto.steps.delete &&
            updateFlowWithStepsDto.steps.delete.length > 0
          ) {
            await tx
              .delete(flowSteps)
              .where(
                and(
                  eq(flowSteps.flowId, flowId),
                  inArray(flowSteps.id, updateFlowWithStepsDto.steps.delete),
                ),
              );
          }

          // Create new steps if specified and build mapping for placeholder IDs
          if (
            updateFlowWithStepsDto.steps.create &&
            updateFlowWithStepsDto.steps.create.length > 0
          ) {
            const createdSteps = await tx
              .insert(flowSteps)
              .values(
                (updateFlowWithStepsDto.steps.create as any[]).map((step: any) => ({
                  ...step,
                  flowId,
                  stepSpecification: step.stepSpecification ?? null,
                })),
              )
              .returning();

            // Map "new-step-id" to the first created step's ID
            // (this is a simple approach - could be enhanced for multiple new steps)
            if (createdSteps.length > 0) {
              stepIdMap.set("new-step-id", createdSteps[0].id);
            }
          }

          // Update existing steps if specified
          if (
            updateFlowWithStepsDto.steps.update &&
            updateFlowWithStepsDto.steps.update.length > 0
          ) {
            for (const stepUpdate of updateFlowWithStepsDto.steps.update) {
              const { id, ...updateData } = stepUpdate as any;
              await tx
                .update(flowSteps)
                .set({
                  ...updateData,
                  stepSpecification: updateData.stepSpecification ?? null,
                  updatedAt: new Date(),
                })
                .where(and(eq(flowSteps.flowId, flowId), eq(flowSteps.id, id as string)));
            }
          }
        }

        // 3. Handle connection operations
        if (updateFlowWithStepsDto.connections) {
          // Delete connections if specified
          if (
            updateFlowWithStepsDto.connections.delete &&
            updateFlowWithStepsDto.connections.delete.length > 0
          ) {
            await tx
              .delete(flowStepConnections)
              .where(inArray(flowStepConnections.id, updateFlowWithStepsDto.connections.delete));
          }

          // Create new connections if specified (with step ID mapping)
          if (
            updateFlowWithStepsDto.connections.create &&
            updateFlowWithStepsDto.connections.create.length > 0
          ) {
            await tx.insert(flowStepConnections).values(
              (updateFlowWithStepsDto.connections.create as any[]).map((conn: any) => ({
                ...conn,
                flowId,
                sourceStepId: stepIdMap.get(conn.sourceStepId) ?? conn.sourceStepId,
                targetStepId: stepIdMap.get(conn.targetStepId) ?? conn.targetStepId,
                type: conn.type ?? "default",
                animated: conn.animated ?? false,
                priority: conn.priority ?? 0,
              })),
            );
          }

          // Update existing connections if specified
          if (
            updateFlowWithStepsDto.connections.update &&
            updateFlowWithStepsDto.connections.update.length > 0
          ) {
            for (const connUpdate of updateFlowWithStepsDto.connections.update) {
              const { id, ...updateData } = connUpdate as any;
              await tx
                .update(flowStepConnections)
                .set({
                  ...updateData,
                  updatedAt: new Date(),
                })
                .where(eq(flowStepConnections.id, id as string));
            }
          }
        }

        // 4. Get final state with all steps and connections
        const finalSteps = await tx
          .select()
          .from(flowSteps)
          .where(eq(flowSteps.flowId, flowId))
          .orderBy(asc(flowSteps.createdAt));

        const finalConnections = await tx
          .select()
          .from(flowStepConnections)
          .where(eq(flowStepConnections.flowId, flowId));

        return {
          ...updatedFlow,
          steps: finalSteps as unknown as FlowStepDto[],
          connections: finalConnections,
        };
      });
    });
  }
}
