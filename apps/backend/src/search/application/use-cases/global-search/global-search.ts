import { Injectable, Logger } from "@nestjs/common";

import type { SearchResult, SearchResultType } from "@repo/api/schemas/search.schema";

import { Result, isFailure, success } from "../../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../../experiments/core/repositories/experiment.repository";
import { MacroRepository } from "../../../../macros/core/repositories/macro.repository";
import { ProtocolRepository } from "../../../../protocols/core/repositories/protocol.repository";

/** Max results taken per entity type before cross-type merging. */
const PER_TYPE_LIMIT = 8;

/** Minimal shape every entity DTO shares; all global search needs to render a result row. */
interface SearchableEntity {
  id: string;
  name: string;
  description: string | null;
}

@Injectable()
export class GlobalSearchUseCase {
  private readonly logger = new Logger(GlobalSearchUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly protocolRepository: ProtocolRepository,
    private readonly macroRepository: MacroRepository,
  ) {}

  async execute(
    userId: string,
    query: string,
    limit: number,
  ): Promise<Result<{ results: SearchResult[] }>> {
    this.logger.log({ msg: "Global search", operation: "globalSearch" });

    // Delegate to the per-entity focused search (`findAll`) so global search matches and ranks
    // by exactly the same rules — there is one search definition per entity, and global search
    // is purely a consumer of it. Each `findAll` already returns rows in descending relevance.
    const perType = Math.min(PER_TYPE_LIMIT, limit);
    const [experiments, protocols, macros] = await Promise.all([
      this.experimentRepository.findAll(userId, undefined, undefined, query, perType),
      this.protocolRepository.findAll(query, undefined, undefined, perType),
      this.macroRepository.findAll({ search: query }, perType),
    ]);

    if (isFailure(experiments)) return experiments;
    if (isFailure(protocols)) return protocols;
    if (isFailure(macros)) return macros;

    // Each `findAll` ranks within its own type, but those scores aren't exposed (or comparable)
    // across types, so we merge by rank position: the top hit of every type scores ~1, and items
    // interleave by their standing within their type.
    const results = [
      ...toResults(experiments.value, "experiment", () => null),
      ...toResults(protocols.value, "protocol", (p) => p.family),
      ...toResults(macros.value, "macro", (m) => m.language),
    ]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return success({ results });
  }
}

/**
 * Score already-relevance-ordered rows by rank position (the repo caps the count via `limit`).
 * `meta` extracts the optional type-specific label shown beside the title (language / family).
 */
function toResults<T extends SearchableEntity>(
  rows: T[],
  type: SearchResultType,
  meta: (row: T) => string | null,
): SearchResult[] {
  return rows.map((row, index) => ({
    type,
    id: row.id,
    title: row.name,
    subtitle: row.description,
    meta: meta(row),
    score: (rows.length - index) / rows.length,
  }));
}
