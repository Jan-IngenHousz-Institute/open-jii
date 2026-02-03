import { Injectable, Inject } from "@nestjs/common";

import { eq, flows } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import type { FlowDto, FlowGraphDto } from "../models/flow.model";

@Injectable()
export class FlowRepository {
  constructor(
    @Inject("DATABASE_READER")
    private readonly reader: DatabaseInstance,
    @Inject("DATABASE_WRITER")
    private readonly writer: DatabaseInstance,
  ) {}

  async getByExperimentId(experimentId: string): Promise<Result<FlowDto | null>> {
    return tryCatch(async () => {
      const result = await this.reader
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
      const inserted = await this.writer
        .insert(flows)
        .values({ experimentId, graph })
        .returning();
      const row = inserted[0];
      return row as FlowDto;
    });
  }

  async update(experimentId: string, graph: FlowGraphDto): Promise<Result<FlowDto>> {
    return tryCatch(async () => {
      const updated = await this.writer
        .update(flows)
        .set({ graph })
        .where(eq(flows.experimentId, experimentId))
        .returning();
      const row = updated[0];
      return row as FlowDto;
    });
  }
}
