import { Injectable, Inject } from "@nestjs/common";

import { eq, flows } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import type { FlowDto, FlowGraphDto } from "../models/flow.model";
import { ExperimentQuestionTypesRepository } from "./experiment-question-types.repository";

@Injectable()
export class FlowRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
    private readonly questionTypes: ExperimentQuestionTypesRepository,
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
    return this.questionTypes.saveFlow(experimentId, graph, "create");
  }

  async update(experimentId: string, graph: FlowGraphDto): Promise<Result<FlowDto>> {
    return this.questionTypes.saveFlow(experimentId, graph, "update");
  }

  async upsert(experimentId: string, graph: FlowGraphDto): Promise<Result<FlowDto>> {
    return this.questionTypes.saveFlow(experimentId, graph, "upsert");
  }

  async importLegacy(experimentId: string, graph: FlowGraphDto): Promise<Result<FlowDto>> {
    return this.questionTypes.saveFlow(experimentId, graph, "upsert", true);
  }

  async deleteByExperimentId(experimentId: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database.delete(flows).where(eq(flows.experimentId, experimentId));
    });
  }
}
