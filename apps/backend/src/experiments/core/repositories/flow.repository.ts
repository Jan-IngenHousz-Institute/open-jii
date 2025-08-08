import { Injectable, Inject } from "@nestjs/common";

import { eq, flows } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { flowGraphSchema } from "../models/flow.model";
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

  async upsert(experimentId: string, graph: FlowGraphDto): Promise<Result<FlowDto>> {
    return tryCatch(async () => {
      const validatedGraph = flowGraphSchema.parse(graph);

      const inserted = await this.database
        .insert(flows)
        .values({ experimentId, graph: validatedGraph })
        .onConflictDoUpdate({
          target: [flows.experimentId],
          set: { graph: validatedGraph },
        })
        .returning();
      const row = inserted[0];
      return row as FlowDto;
    });
  }
}
