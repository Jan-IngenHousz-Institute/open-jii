import { Injectable, Inject } from "@nestjs/common";

import { eq, flows } from "@repo/database";
import type { DatabaseInstance, DbOrTx } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import type { FlowDto, FlowGraphDto } from "../models/flow.model";

@Injectable()
export class FlowRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async getByExperimentId(experimentId: string): Promise<Result<FlowDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(flows)
        .where(eq(flows.experimentId, experimentId))
        .limit(1);
      if (result.length === 0) return null;
      const row = result[0];
      return row as FlowDto;
    });
  }

  async create(experimentId: string, graph: FlowGraphDto): Promise<Result<FlowDto>> {
    return tryCatch(async () => {
      const inserted = await this.database
        .insert(flows)
        .values({ experimentId, graph })
        .returning();
      const row = inserted[0];
      return row as FlowDto;
    });
  }

  async update(experimentId: string, graph: FlowGraphDto): Promise<Result<FlowDto>> {
    return tryCatch(async () => {
      const updated = await this.database
        .update(flows)
        .set({ graph })
        .where(eq(flows.experimentId, experimentId))
        .returning();
      const row = updated[0];
      return row as FlowDto;
    });
  }

  // Race-free via ON CONFLICT against the unique experiment_id constraint.
  // Accepts an optional transaction handle so callers can bind the flow row and
  // the experiment pointer atomically.
  async upsert(
    experimentId: string,
    graph: FlowGraphDto,
    db: DbOrTx = this.database,
  ): Promise<Result<FlowDto>> {
    return tryCatch(async () => {
      const rows = await db
        .insert(flows)
        .values({ experimentId, graph })
        .onConflictDoUpdate({
          target: flows.experimentId,
          set: { graph },
        })
        .returning();
      return rows[0] as FlowDto;
    });
  }

  async deleteByExperimentId(
    experimentId: string,
    db: DbOrTx = this.database,
  ): Promise<Result<void>> {
    return tryCatch(async () => {
      await db.delete(flows).where(eq(flows.experimentId, experimentId));
    });
  }
}
