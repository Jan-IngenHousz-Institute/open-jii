import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import { sanitizeQuestionLabel } from "@repo/api/transforms/label-sanitization";

import { VariantSchema } from "../../../common/modules/databricks/services/query-builder/schema/variant-schema";
import { success } from "../../../common/utils/fp-utils";
import type { Result } from "../../../common/utils/fp-utils";
import type { ExperimentTableMetadata } from "../../core/models/experiment-data.model";
import type { FlowDto, FlowGraphDto } from "../../core/models/flow.model";
import { FlowRepository } from "../../core/repositories/flow.repository";

/**
 * Gold stores every answer as text. A Number question in the experiment's flow reads as DOUBLE,
 * so its answers cast on read and one that is not a number reads as null, whichever source reads.
 */
@Injectable()
export class NumberAnswersService {
  constructor(private readonly flowRepository: FlowRepository) {}

  async typed(
    experimentId: string,
    tables: ExperimentTableMetadata[],
  ): Promise<Result<ExperimentTableMetadata[]>> {
    const hasAnswers = tables.some((table) => table.questionsSchema);
    if (!hasAnswers) {
      return success(tables);
    }

    const flow = await this.flowRepository.getByExperimentId(experimentId);
    if (flow.isFailure()) {
      return flow;
    }

    const numberKeys = this.numberQuestionKeys(flow.value);
    if (numberKeys.size === 0) {
      return success(tables);
    }

    return success(tables.map((table) => this.withNumberAnswers(table, numberKeys)));
  }

  private numberQuestionKeys(flow: FlowDto | null): Set<string> {
    const nodes = flow?.graph.nodes ?? [];
    return new Set(
      nodes
        .filter((node) => this.isNumberQuestion(node))
        .map((node) => this.pipelineKey(node.name)),
    );
  }

  private isNumberQuestion(node: FlowGraphDto["nodes"][number]): boolean {
    return node.type === "question" && "kind" in node.content && node.content.kind === "number";
  }

  /** Gold's `_key` also collapses underscores the name already holds, which the shared rule keeps. */
  private pipelineKey(name: string): string {
    return sanitizeQuestionLabel(name).replace(/_+/g, "_");
  }

  /** The revision changes with the typed keys, so cached column lists follow a flow edit. */
  private withNumberAnswers(
    table: ExperimentTableMetadata,
    numberKeys: ReadonlySet<string>,
  ): ExperimentTableMetadata {
    if (!table.questionsSchema) {
      return table;
    }

    const typed = VariantSchema.topLevelFieldNames(table.questionsSchema)
      .filter((name) => numberKeys.has(name))
      .sort();
    if (typed.length === 0) {
      return table;
    }

    const typedRevision = createHash("md5").update(typed.join("|")).digest("hex");
    return {
      ...table,
      questionsSchema: VariantSchema.withDoubles(table.questionsSchema, new Set(typed)),
      schemaRevision: `${table.schemaRevision ?? ""}:${typedRevision}`,
    };
  }
}
