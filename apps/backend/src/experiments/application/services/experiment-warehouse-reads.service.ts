import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import { sanitizeQuestionLabel } from "@repo/api/transforms/label-sanitization";

import { VariantSchema } from "../../../common/modules/databricks/services/query-builder/schema/variant-schema";
import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import { success } from "../../../common/utils/fp-utils";
import type { Result } from "../../../common/utils/fp-utils";
import type {
  ExperimentQueryParams,
  ExperimentTableMetadata,
  ExperimentTableType,
} from "../../core/models/experiment-data.model";
import type { FlowDto, FlowGraphDto } from "../../core/models/flow.model";
import { DATABRICKS_PORT } from "../../core/ports/databricks.port";
import type { DatabricksPort } from "../../core/ports/databricks.port";
import type {
  ExperimentTableReads,
  TableQuery,
} from "../../core/ports/experiment-table-reads.port";
import { FlowRepository } from "../../core/repositories/flow.repository";

/** Reads through the warehouse's views, which join contributors, devices and annotations. */
@Injectable()
export class ExperimentWarehouseReadsService implements ExperimentTableReads {
  readonly picksLargePagesById = true;

  constructor(
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
    private readonly flowRepository: FlowRepository,
  ) {}

  readsTable(): boolean {
    return true;
  }

  /**
   * Gold stores every answer as text. A Number question in the experiment's flow reads as DOUBLE,
   * so its answers cast on read and one that is not a number reads as null.
   */
  async tablesMetadata(experimentId: string): Promise<Result<ExperimentTableMetadata[]>> {
    const metadata = await this.databricksPort.getExperimentTableMetadata(experimentId, {
      includeSchemas: true,
    });
    if (metadata.isFailure()) {
      return metadata;
    }

    const flow = await this.flowRepository.getByExperimentId(experimentId);
    if (flow.isFailure()) {
      return flow;
    }

    const numberKeys = this.numberQuestionKeys(flow.value);
    if (numberKeys.size === 0) {
      return metadata;
    }

    return success(metadata.value.map((table) => this.withNumberAnswers(table, numberKeys)));
  }

  viewColumns(tableType: ExperimentTableType, identifier: string): Promise<Result<string[]>> {
    return this.databricksPort.getExperimentTableColumns(tableType, identifier);
  }

  buildQuery(params: ExperimentQueryParams): Promise<Result<TableQuery>> {
    const built = this.databricksPort.buildExperimentQuery(params);
    if (built.isFailure()) {
      return Promise.resolve(built);
    }
    return Promise.resolve(
      success({ sql: built.value, columns: [], distinct: params.distinct ?? false }),
    );
  }

  countQuery(query: TableQuery): TableQuery {
    return {
      sql: `SELECT COUNT(*) AS total FROM (${query.sql}) AS sub`,
      columns: [],
      distinct: false,
    };
  }

  runQuery(query: TableQuery): Promise<Result<SchemaData>> {
    return this.databricksPort.executeSqlQuery(this.databricksPort.CENTRUM_SCHEMA_NAME, query.sql);
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
