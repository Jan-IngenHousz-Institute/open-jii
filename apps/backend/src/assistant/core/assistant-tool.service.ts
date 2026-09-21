import { Injectable } from "@nestjs/common";
import { z } from "zod";

import {
  zAssistantNewDraftPayload,
  zAssistantSource,
} from "@repo/api/domains/assistant/assistant.schema";
import type {
  AssistantDraftPayload,
  AssistantSource,
  AssistantToolCall,
} from "@repo/api/domains/assistant/assistant.schema";
import {
  zExperimentDataAggregation,
  zExperimentDataFilter,
} from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentDataQuery } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { AssistantKnowledgeService } from "../../assistant-knowledge/assistant-knowledge.service";
import { AuthorizationService } from "../../authorization/authorization.service";
import { GetExperimentDataUseCase } from "../../experiments/application/use-cases/experiment-data/get-experiment-data/get-experiment-data";
import { GetExperimentUseCase } from "../../experiments/application/use-cases/get-experiment/get-experiment";
import { GetMacroUseCase } from "../../macros/application/use-cases/get-macro/get-macro";
import { GetProtocolUseCase } from "../../protocols/application/use-cases/get-protocol/get-protocol";
import { GlobalSearchUseCase } from "../../search/application/use-cases/global-search/global-search";
import { GetWorkbookUseCase } from "../../workbooks/application/use-cases/get-workbook/get-workbook";
import type { AssistantToolResult } from "./assistant-model.service";

export interface DraftProposal {
  payload: AssistantDraftPayload;
  source?: AssistantSource;
}

export interface ExecutedAssistantTool extends AssistantToolResult {
  sources: AssistantSource[];
  draft?: DraftProposal;
}

export function getAssistantDraftReadReferences(payload: AssistantDraftPayload) {
  const references: { type: "experiment" | "protocol" | "workbook" | "macro"; id: string }[] = [];
  if (payload.kind === "experiment" && payload.value.workbookId) {
    references.push({ type: "workbook", id: payload.value.workbookId });
  } else if (
    payload.kind !== "experiment" &&
    payload.kind !== "visualization" &&
    payload.value.forkedFrom
  ) {
    references.push({ type: payload.kind, id: payload.value.forkedFrom });
  }
  if (payload.kind === "workbook") {
    for (const cell of payload.value.cells ?? []) {
      if (cell.type === "protocol")
        references.push({ type: "protocol", id: cell.payload.protocolId });
      if (cell.type === "macro") references.push({ type: "macro", id: cell.payload.macroId });
    }
  }
  return [
    ...new Map(
      references.map((reference) => [`${reference.type}:${reference.id}`, reference]),
    ).values(),
  ];
}

const zSearchArgs = z.object({
  query: z.string().trim().min(1).max(200),
  limit: z.number().int().min(1).max(10).optional().default(5),
});

const zGetArgs = z.object({
  type: z.enum(["experiment", "protocol", "workbook", "macro"]),
  id: z.string().uuid(),
});

const zDataQueryArgs = z.object({
  experimentId: z.string().uuid(),
  tableName: z.string().min(1).max(256),
  columns: z.string().max(2000).optional(),
  filters: z.array(zExperimentDataFilter).max(20).optional(),
  aggregation: zExperimentDataAggregation.optional(),
  orderBy: z.string().max(256).optional(),
  orderDirection: z.enum(["ASC", "DESC"]).optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
});

const zKnowledgeArgs = z.object({
  query: z.string().trim().min(2).max(500),
  sourceTypes: z
    .array(z.enum(["docs", "corpus", "document"]))
    .min(1)
    .max(3)
    .optional(),
  limit: z.number().int().min(1).max(10).optional().default(4),
});

const zDraftSource = z.object({
  type: z.enum(["experiment", "protocol", "workbook", "macro"]),
  id: z.string().uuid(),
  title: z.string().min(1),
});

const zDraftArgs = z.object({
  kind: z.enum(["experiment", "protocol", "workbook", "macro", "visualization"]),
  value: z.unknown(),
  source: zDraftSource.optional(),
});

@Injectable()
export class AssistantToolService {
  constructor(
    private readonly authorization: AuthorizationService,
    private readonly search: GlobalSearchUseCase,
    private readonly getExperiment: GetExperimentUseCase,
    private readonly getProtocol: GetProtocolUseCase,
    private readonly getWorkbook: GetWorkbookUseCase,
    private readonly getMacro: GetMacroUseCase,
    private readonly getExperimentData: GetExperimentDataUseCase,
    private readonly knowledge: AssistantKnowledgeService,
  ) {}

  async execute(
    userId: string,
    name: string,
    rawArgs: unknown,
    callId: string,
  ): Promise<ExecutedAssistantTool> {
    try {
      if (name === "search_entities") return await this.searchEntities(userId, rawArgs, callId);
      if (name === "get_entity") return await this.readEntity(userId, rawArgs, callId);
      if (name === "search_knowledge") return await this.searchKnowledge(userId, rawArgs, callId);
      if (name === "query_experiment_data") {
        return await this.queryExperimentData(userId, rawArgs, callId);
      }
      if (name === "draft_entity") return await this.draftEntity(userId, rawArgs, callId);
      return this.failed(callId, name, "This tool is not available");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool execution failed";
      return this.failed(callId, name, message);
    }
  }

  private async searchKnowledge(
    userId: string,
    rawArgs: unknown,
    callId: string,
  ): Promise<ExecutedAssistantTool> {
    const args = zKnowledgeArgs.parse(rawArgs);
    const result = await this.knowledge.search(userId, args);
    if (result.isFailure()) return this.failed(callId, "search_knowledge", result.error.message);
    const sources: AssistantSource[] = result.value.hits.map((hit) => ({
      id: `${hit.citation.sourceType}:${hit.citation.sourceId}:${hit.citation.page ?? ""}`,
      type: hit.citation.sourceType === "corpus" ? "literature" : "docs",
      title: hit.citation.title,
      url: hit.citation.route ?? hit.citation.sourceUrl ?? undefined,
      excerpt: hit.excerpt,
      year: hit.citation.year ?? undefined,
      page: hit.citation.page ?? undefined,
    }));
    return this.completed(
      callId,
      "search_knowledge",
      result.value.answerable
        ? `Found ${result.value.hits.length} knowledge sources`
        : "The configured knowledge sources could not answer this question",
      {
        ...result.value,
        hits: result.value.hits.map((hit) => ({
          ...hit,
          citation: {
            ...hit.citation,
            route:
              hit.citation.sourceType === "docs"
                ? (hit.citation.sourceUrl ?? hit.citation.route)
                : hit.citation.route,
          },
        })),
      },
      sources,
    );
  }

  private async searchEntities(
    userId: string,
    rawArgs: unknown,
    callId: string,
  ): Promise<ExecutedAssistantTool> {
    const args = zSearchArgs.parse(rawArgs);
    const result = await this.search.execute(userId, args.query, args.limit);
    if (result.isFailure()) return this.failed(callId, "search_entities", result.error.message);
    const sources: AssistantSource[] = result.value.results.flatMap((item) =>
      item.type === "organization"
        ? []
        : [
            {
              id: `${item.type}:${item.id}`,
              type: "entity",
              title: item.title,
              url: this.entityUrl(item.type, item.id),
              excerpt: item.subtitle ?? undefined,
              entityType: item.type,
              entityId: item.id,
            },
          ],
    );
    return this.completed(
      callId,
      "search_entities",
      `Found ${result.value.results.length} visible results`,
      result.value,
      sources,
    );
  }

  private async readEntity(
    userId: string,
    rawArgs: unknown,
    callId: string,
  ): Promise<ExecutedAssistantTool> {
    const args = zGetArgs.parse(rawArgs);
    const decision = await this.authorization.can(userId, {
      resourceType: args.type,
      resourceId: args.id,
      action: "read",
    });
    if (!decision.allow)
      return this.failed(callId, "get_entity", "Entity not found or unavailable");

    const result =
      args.type === "experiment"
        ? await this.getExperiment.execute(args.id, userId)
        : args.type === "protocol"
          ? await this.getProtocol.execute(args.id)
          : args.type === "workbook"
            ? await this.getWorkbook.execute(args.id)
            : await this.getMacro.execute(args.id);
    if (result.isFailure()) return this.failed(callId, "get_entity", result.error.message);
    const value = result.value;
    const source: AssistantSource = {
      id: `${args.type}:${args.id}`,
      type: "entity",
      title: value.name,
      url: this.entityUrl(args.type, args.id),
      excerpt: value.description?.slice(0, 1000) ?? undefined,
      entityType: args.type,
      entityId: args.id,
    };
    return this.completed(callId, "get_entity", `Read ${args.type} ${value.name}`, value, [source]);
  }

  private async queryExperimentData(
    userId: string,
    rawArgs: unknown,
    callId: string,
  ): Promise<ExecutedAssistantTool> {
    const args = zDataQueryArgs.parse(rawArgs);
    const decision = await this.authorization.can(userId, {
      resourceType: "experiment",
      resourceId: args.experimentId,
      action: "read",
    });
    if (!decision.allow) {
      return this.failed(callId, "query_experiment_data", "Experiment not found or unavailable");
    }
    const query: ExperimentDataQuery = {
      tableName: args.tableName,
      columns: args.columns,
      filters: args.filters,
      aggregation: args.aggregation,
      orderBy: args.orderBy,
      orderDirection: args.orderDirection,
      limit: args.limit,
    };
    const result = await this.getExperimentData.execute(args.experimentId, userId, query);
    if (result.isFailure()) {
      return this.failed(callId, "query_experiment_data", result.error.message);
    }
    const first = result.value[0];
    if (!first.data) {
      return this.failed(
        callId,
        "query_experiment_data",
        "The experiment query returned no readable data",
      );
    }
    const modelResult = {
      experimentId: args.experimentId,
      query: args,
      columns: first.data.columns,
      rows: first.data.rows,
      totalRows: first.totalRows,
      truncated: first.data.truncated,
    };
    return this.completed(
      callId,
      "query_experiment_data",
      `Queried ${args.tableName}; ${modelResult.rows.length} rows returned`,
      modelResult,
      [
        {
          id: `experiment:${args.experimentId}`,
          type: "entity",
          title: `Experiment data: ${args.tableName}`,
          url: this.entityUrl("experiment", args.experimentId),
          entityType: "experiment",
          entityId: args.experimentId,
        },
      ],
    );
  }

  private async draftEntity(
    userId: string,
    rawArgs: unknown,
    callId: string,
  ): Promise<ExecutedAssistantTool> {
    const args = zDraftArgs.parse(rawArgs);
    const parsed = zAssistantNewDraftPayload.parse({ kind: args.kind, value: args.value });
    if (parsed.kind !== "visualization") parsed.value.visibility ??= "private";
    const payload = parsed;
    let source: AssistantSource | undefined;
    if (args.source) {
      const decision = await this.authorization.can(userId, {
        resourceType: args.source.type,
        resourceId: args.source.id,
        action: "read",
      });
      if (!decision.allow) {
        return this.failed(callId, "draft_entity", "Source not found or unavailable");
      }
      source = zAssistantSource.parse({
        id: `${args.source.type}:${args.source.id}`,
        type: "entity",
        title: args.source.title,
        url: this.entityUrl(args.source.type, args.source.id),
        entityType: args.source.type,
        entityId: args.source.id,
      });
    }
    for (const reference of getAssistantDraftReadReferences(payload)) {
      const decision = await this.authorization.can(userId, {
        resourceType: reference.type,
        resourceId: reference.id,
        action: "read",
      });
      if (!decision.allow)
        return this.failed(callId, "draft_entity", "A draft reference is not readable");
    }
    const modelResult = {
      status: "pending_confirmation",
      kind: payload.kind,
      payload: payload.value,
      persistedFields: Object.keys(payload.value).filter((field) => field !== "codeEncoding"),
      message:
        "A preview was prepared. Nothing has been created or executed. Describe only the returned payload as drafted. Protocol recipes still require validation on actual equipment.",
    };
    return {
      ...this.completed(
        callId,
        "draft_entity",
        `Prepared ${payload.kind} draft for confirmation`,
        modelResult,
        source ? [source] : [],
      ),
      draft: { payload, source },
    };
  }

  private completed(
    id: string,
    name: string,
    summary: string,
    modelResult: unknown,
    sources: AssistantSource[],
  ): ExecutedAssistantTool {
    const toolCall: AssistantToolCall = {
      id,
      name,
      status: "completed",
      summary,
      result: modelResult,
    };
    return { modelResult, toolCall, sources };
  }

  private failed(id: string, name: string, error: string): ExecutedAssistantTool {
    const toolCall: AssistantToolCall = {
      id,
      name,
      status: "failed",
      summary: error,
      error,
    };
    return { modelResult: { error }, toolCall, sources: [] };
  }

  private entityUrl(type: string, id: string): string {
    if (type === "experiment") return `/platform/experiments/${id}`;
    if (type === "protocol") return `/platform/protocols/${id}`;
    if (type === "macro") return `/platform/macros/${id}`;
    if (type === "workbook") return `/platform/workbooks/${id}`;
    return `/platform`;
  }
}
