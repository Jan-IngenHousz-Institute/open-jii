import { Injectable, Inject, Logger } from "@nestjs/common";

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
} from "../models/flow.model";

export class FlowStepRepositoryError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, "FLOW_STEP_REPOSITORY_ERROR", 500, { cause });
  }
}

@Injectable()
export class FlowStepRepository {
  private readonly logger = new Logger(FlowStepRepository.name);

  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async create(flowId: string, createFlowStepDto: CreateFlowStepDto) {
    return tryCatch(async () => {
      const result = await this.database
        .insert(flowSteps)
        .values({
          ...createFlowStepDto,
          flowId,
          // Convert step-specific config to JSONB
          stepSpecification: createFlowStepDto.stepSpecification ?? null,
        })
        .returning();

      // Transform Drizzle types to DTO types
      return result as FlowStepDto[];
    });
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

  async getConnections(flowId: string) {
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

  async getFlowWithConnections(flowId: string) {
    const stepsResult = await this.findByFlowId(flowId);
    if (stepsResult.isFailure()) {
      return stepsResult;
    }

    const connectionsResult = await this.getConnections(flowId);
    if (connectionsResult.isFailure()) {
      return connectionsResult;
    }

    return success({
      steps: stepsResult.value,
      connections: connectionsResult.value,
    });
  }

  // Bulk operations for React Flow frontend integration
  async createFlowWithSteps(createFlowWithStepsDto: CreateFlowWithStepsDto, userId: string) {
    this.logger.log(`Creating flow with steps: ${createFlowWithStepsDto.name}`, {
      stepsCount: createFlowWithStepsDto.steps.length,
      connectionsCount: createFlowWithStepsDto.connections?.length ?? 0,
    });

    return tryCatch(async () => {
      return await this.database.transaction(async (tx) => {
        this.logger.log("Starting database transaction for flow creation");

        // 1. Create the flow
        const createdFlows = await tx
          .insert(flows)
          .values({
            name: createFlowWithStepsDto.name,
            description: createFlowWithStepsDto.description,
            version: createFlowWithStepsDto.version ?? 1,
            isActive: createFlowWithStepsDto.isActive ?? true,
            createdBy: userId,
          })
          .returning();

        this.logger.log(`Flow created with ID: ${createdFlows[0].id}`);

        // 2. Create all steps with temporary ID mapping
        const createdSteps = await tx
          .insert(flowSteps)
          .values(
            createFlowWithStepsDto.steps.map((step) => ({
              flowId: createdFlows[0].id,
              type: step.type,
              title: step.title,
              description: step.description,
              media: step.media,
              position: step.position,
              size: step.size,
              isStartNode: step.isStartNode ?? false,
              isEndNode: step.isEndNode ?? false,
              stepSpecification: step.stepSpecification,
            })),
          )
          .returning();

        this.logger.log(`Created ${createdSteps.length} flow steps`);

        // 3. Create connections if provided
        const createdConnections: FlowWithGraphDto["connections"] = [];
        if (createFlowWithStepsDto.connections && createFlowWithStepsDto.connections.length > 0) {
          this.logger.log(`Creating ${createFlowWithStepsDto.connections.length} connections`);

          // Create a mapping from temp step IDs to actual step IDs based on position in array
          // This assumes the steps array order matches the creation order
          // Support both temp-step-X and temp-id-X formats for backwards compatibility
          const stepIdMapping = new Map<string, string>();
          createFlowWithStepsDto.steps.forEach((step, index) => {
            const tempStepId = `temp-step-${index + 1}`;
            const tempId = `temp-id-${index + 1}`;
            const realId = createdSteps[index].id;

            stepIdMapping.set(tempStepId, realId);
            stepIdMapping.set(tempId, realId);

            this.logger.log(`Mapped temp IDs ${tempStepId} and ${tempId} to real ID ${realId}`);
          });

          // Map connections to use real step IDs
          const connectionsToCreate = createFlowWithStepsDto.connections.map((conn) => ({
            flowId: createdFlows[0].id,
            sourceStepId: stepIdMapping.get(conn.sourceStepId) ?? conn.sourceStepId,
            targetStepId: stepIdMapping.get(conn.targetStepId) ?? conn.targetStepId,
            type: conn.type ?? "default",
            animated: conn.animated ?? false,
            label: conn.label ?? null,
            condition: conn.condition ?? null,
            priority: conn.priority ?? 0,
          }));

          const connections = (await tx
            .insert(flowStepConnections)
            .values(connectionsToCreate)
            .returning()) as unknown as FlowWithGraphDto["connections"];

          createdConnections.push(...connections);
          this.logger.log(`Created ${connections.length} connections successfully`);
        }

        this.logger.log("Transaction completed successfully");
        // Return the complete flow structure
        return {
          ...createdFlows[0],
          steps: createdSteps,
          connections: createdConnections,
        } as FlowWithGraphDto;
      });
    });
  }

  async updateFlowWithSteps(flowId: string, updateFlowWithStepsDto: UpdateFlowWithStepsDto) {
    return tryCatch(async () => {
      return this.database.transaction(async (tx) => {
        // 1. Update or get flow
        const updatedFlow = await this.handleFlowUpdate(tx, flowId, updateFlowWithStepsDto.flow);

        // 2. Handle step operations with ID mapping for new steps
        const stepIdMap = updateFlowWithStepsDto.steps
          ? await this.handleStepOperations(tx, flowId, updateFlowWithStepsDto.steps)
          : new Map<string, string>();

        // 3. Handle connection operations (using upsert where possible)
        if (updateFlowWithStepsDto.connections) {
          await this.handleConnectionOperations(
            tx,
            flowId,
            updateFlowWithStepsDto.connections,
            stepIdMap,
          );
        }

        // 4. Get final state
        return this.getFinalFlowState(tx, flowId, updatedFlow);
      });
    });
  }

  private async handleFlowUpdate<T extends Pick<DatabaseInstance, "select" | "update">>(
    tx: T,
    flowId: string,
    flowUpdate?: Partial<typeof flows.$inferInsert>,
  ): Promise<typeof flows.$inferSelect> {
    if (flowUpdate) {
      const updatedFlows = await tx
        .update(flows)
        .set(flowUpdate)
        .where(eq(flows.id, flowId))
        .returning();

      if (updatedFlows.length === 0) {
        throw AppError.notFound("Flow not found");
      }
      return updatedFlows[0];
    }

    const existingFlows = await tx.select().from(flows).where(eq(flows.id, flowId)).limit(1);
    if (existingFlows.length === 0) {
      throw AppError.notFound("Flow not found");
    }
    return existingFlows[0];
  }

  private async handleStepOperations<
    T extends Pick<DatabaseInstance, "delete" | "insert" | "update">,
  >(
    tx: T,
    flowId: string,
    stepOperations: NonNullable<UpdateFlowWithStepsDto["steps"]>,
  ): Promise<Map<string, string>> {
    const stepIdMap = new Map<string, string>();

    // Delete steps
    if (stepOperations.delete?.length) {
      await tx
        .delete(flowSteps)
        .where(and(eq(flowSteps.flowId, flowId), inArray(flowSteps.id, stepOperations.delete)));
    }

    // Create new steps
    if (stepOperations.create?.length) {
      const createdSteps = await tx
        .insert(flowSteps)
        .values(
          stepOperations.create.map((step) => ({
            ...step,
            flowId,
            stepSpecification: step.stepSpecification ?? null,
          })),
        )
        .returning();

      // Build step ID mapping for placeholder IDs
      for (let index = 0; index < createdSteps.length; index++) {
        const step = createdSteps[index];
        stepIdMap.set(`new-step-${index + 1}`, step.id);
        stepIdMap.set("new-step-id", step.id); // Simple fallback for single step
      }
    }

    // Update existing steps
    if (stepOperations.update?.length) {
      for (const { id, ...updateData } of stepOperations.update) {
        await tx
          .update(flowSteps)
          .set({
            ...updateData,
            stepSpecification: updateData.stepSpecification ?? null,
          })
          .where(and(eq(flowSteps.flowId, flowId), eq(flowSteps.id, id)));
      }
    }

    return stepIdMap;
  }

  private async handleConnectionOperations<
    T extends Pick<DatabaseInstance, "delete" | "insert" | "update">,
  >(
    tx: T,
    flowId: string,
    connectionOperations: NonNullable<UpdateFlowWithStepsDto["connections"]>,
    stepIdMap: Map<string, string>,
  ): Promise<void> {
    // Delete connections
    if (connectionOperations.delete?.length) {
      await tx
        .delete(flowStepConnections)
        .where(inArray(flowStepConnections.id, connectionOperations.delete));
    }

    // Create new connections
    if (connectionOperations.create?.length) {
      for (const conn of connectionOperations.create) {
        const connectionData = {
          ...conn,
          flowId,
          sourceStepId: stepIdMap.get(conn.sourceStepId) ?? conn.sourceStepId,
          targetStepId: stepIdMap.get(conn.targetStepId) ?? conn.targetStepId,
          type: conn.type ?? "default",
          animated: conn.animated ?? false,
          priority: conn.priority ?? 0,
        };

        try {
          await tx.insert(flowStepConnections).values(connectionData);
        } catch (error) {
          // If connection already exists (unique constraint violation), update it
          if (error instanceof Error && error.message.toLowerCase().includes("unique")) {
            await tx
              .update(flowStepConnections)
              .set({
                type: connectionData.type,
                animated: connectionData.animated,
                label: connectionData.label,
                condition: connectionData.condition,
                priority: connectionData.priority,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(flowStepConnections.sourceStepId, connectionData.sourceStepId),
                  eq(flowStepConnections.targetStepId, connectionData.targetStepId),
                ),
              );
          } else {
            throw error;
          }
        }
      }
    }

    // Update existing connections
    if (connectionOperations.update?.length) {
      for (const { id, ...updateData } of connectionOperations.update) {
        await tx.update(flowStepConnections).set(updateData).where(eq(flowStepConnections.id, id));
      }
    }
  }

  private async getFinalFlowState<T extends Pick<DatabaseInstance, "select">>(
    tx: T,
    flowId: string,
    updatedFlow: typeof flows.$inferSelect,
  ) {
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
      steps: finalSteps,
      connections: finalConnections,
    };
  }
}
