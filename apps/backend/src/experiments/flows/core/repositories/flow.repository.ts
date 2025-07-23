import { Injectable, Inject } from "@nestjs/common";

import { eq, and, desc, flows, flowSteps } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, AppError, tryCatch } from "../../../../common/utils/fp-utils";
import { CreateFlowDto, UpdateFlowDto, FlowDto } from "../models/flow.model";

export class FlowRepositoryError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, "FLOW_REPOSITORY_ERROR", 500, { cause });
  }
}

export class FlowNotFoundError extends AppError {
  constructor(id: string) {
    super(`Flow with ID ${id} not found`, "FLOW_NOT_FOUND", 404, { id });
  }
}

@Injectable()
export class FlowRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async create(createFlowDto: CreateFlowDto, userId: string): Promise<Result<FlowDto[]>> {
    return tryCatch(() =>
      this.database
        .insert(flows)
        .values({
          ...createFlowDto,
          createdBy: userId,
        })
        .returning(),
    );
  }

  async findAll(): Promise<Result<FlowDto[]>> {
    return tryCatch(() =>
      this.database
        .select()
        .from(flows)
        .where(eq(flows.isActive, true))
        .orderBy(desc(flows.createdAt)),
    );
  }

  async findOne(id: string): Promise<Result<FlowDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(flows)
        .where(and(eq(flows.id, id), eq(flows.isActive, true)))
        .limit(1);

      return result.length === 0 ? null : (result[0] as unknown as FlowDto);
    });
  }

  async update(id: string, updateFlowDto: UpdateFlowDto): Promise<Result<FlowDto[]>> {
    return tryCatch(() =>
      this.database
        .update(flows)
        .set({
          ...updateFlowDto,
          updatedAt: new Date(),
        })
        .where(eq(flows.id, id))
        .returning(),
    );
  }

  async delete(id: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .update(flows)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(flows.id, id));
    });
  }

  async hardDelete(id: string): Promise<Result<void>> {
    return tryCatch(async () => {
      // Delete flow steps first due to foreign key constraint
      await this.database.delete(flowSteps).where(eq(flowSteps.flowId, id));
      // Then delete the flow
      await this.database.delete(flows).where(eq(flows.id, id));
    });
  }
}
