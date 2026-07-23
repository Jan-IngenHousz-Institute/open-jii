import { Injectable, Logger } from "@nestjs/common";

import type { SearchResult, SearchResultType } from "@repo/api/domains/search/search.schema";

import { Result, isFailure, success } from "../../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../../experiments/core/repositories/experiment.repository";
import { MacroRepository } from "../../../../macros/core/repositories/macro.repository";
import { ProtocolRepository } from "../../../../protocols/core/repositories/protocol.repository";
import { WorkbookRepository } from "../../../../workbooks/core/repositories/workbook.repository";

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
    private readonly workbookRepository: WorkbookRepository,
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
    const [experiments, protocols, macros, workbooks] = await Promise.all([
      this.experimentRepository.findAll(userId, undefined, undefined, query, perType),
      this.protocolRepository.findAll(query, undefined, undefined, perType),
      this.macroRepository.findAll({ search: query }, perType),
      this.workbookRepository.findAll({ search: query, userId }, perType),
    ]);

    if (isFailure(experiments)) return experiments;
    if (isFailure(protocols)) return protocols;
    if (isFailure(macros)) return macros;
    if (isFailure(workbooks)) return workbooks;

    // Each `findAll` ranks within its own type, but those scores aren't exposed (or comparable)
    // across types, so we merge by rank position: the top hit of every type scores ~1, and items
    // interleave by their standing within their type. `score` is an internal sort key only — a
    // positional rank, not a true cross-type relevance — so it is stripped before returning.
    const ranked = [
      ...toResults(experiments.value, "experiment", () => null),
      ...toResults(protocols.value, "protocol", (p) => p.family),
      ...toResults(macros.value, "macro", (m) => m.language),
      ...toResults(workbooks.value, "workbook", () => null),
    ]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const results: SearchResult[] = ranked.map(({ score: _score, ...result }) => result);

    return success({ results });
  }
}

/** A `SearchResult` plus the internal positional sort key used to merge across entity types. */
type RankedResult = SearchResult & { score: number };

/**
 * Score already-relevance-ordered rows by rank position (the repo caps the count via `limit`).
 * `meta` extracts the optional type-specific label shown beside the title (language / family).
 */
function toResults<T extends SearchableEntity>(
  rows: T[],
  type: SearchResultType,
  meta: (row: T) => string | null,
): RankedResult[] {
  return rows.map((row, index) => ({
    type,
    id: row.id,
    title: row.name,
    subtitle: row.description,
    meta: meta(row),
    score: (rows.length - index) / rows.length,
  }));
}
