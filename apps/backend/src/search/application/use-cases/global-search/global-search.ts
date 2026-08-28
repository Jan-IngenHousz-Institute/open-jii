import { Injectable, Logger } from "@nestjs/common";

import type { SearchResult, SearchResultType } from "@repo/api/domains/search/search.schema";

import { Result, isFailure, success } from "../../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../../experiments/core/repositories/experiment.repository";
import { MacroRepository } from "../../../../macros/core/repositories/macro.repository";
import { OrganizationRepository } from "../../../../organizations/core/repositories/organization.repository";
import { ProtocolRepository } from "../../../../protocols/core/repositories/protocol.repository";
import { WorkbookRepository } from "../../../../workbooks/core/repositories/workbook.repository";

/** Minimal shape every entity DTO shares; all global search needs to render a result row. */
interface SearchableEntity {
  id: string;
  name: string;
  description: string | null;
  score: number;
}

@Injectable()
export class GlobalSearchUseCase {
  private readonly logger = new Logger(GlobalSearchUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly protocolRepository: ProtocolRepository,
    private readonly macroRepository: MacroRepository,
    private readonly workbookRepository: WorkbookRepository,
    private readonly organizationRepository: OrganizationRepository,
  ) {}

  async execute(
    userId: string,
    query: string,
    limit: number,
  ): Promise<Result<{ results: SearchResult[] }>> {
    this.logger.log({ msg: "Global search", operation: "globalSearch" });

    // Delegate to the per-entity focused search (`findAll`) so global search matches and ranks
    // by exactly the same rules: there is one search definition per entity, and global search
    // is purely a consumer of it. Overfetching `limit` per type removes any per-type recall
    // ceiling, so the 9th-best experiment can still outrank every macro.
    const [experiments, protocols, macros, workbooks, organizations] = await Promise.all([
      this.experimentRepository.findAll(userId, undefined, undefined, query, limit),
      // Pass the caller so each findAll applies the same access scoping it uses
      // for listing: global search must not surface private resources the caller
      // cannot access.
      this.protocolRepository.findAll(query, undefined, userId, limit),
      this.macroRepository.findAll({ search: query, userId }, limit),
      this.workbookRepository.findAll({ search: query, userId }, limit),
      // Organizations are a grantee, never a grantable resource, so their boundary is
      // the directory's own — public or the caller's, personal workspaces never —
      // rather than the shared resource access scope.
      this.organizationRepository.searchDirectory(userId, query, limit),
    ]);

    if (isFailure(experiments)) return experiments;
    if (isFailure(protocols)) return protocols;
    if (isFailure(macros)) return macros;
    if (isFailure(workbooks)) return workbooks;
    if (isFailure(organizations)) return organizations;

    // The repositories compute one comparable score per row (same lexical base, same capped
    // cross-table bonus, same tier weight), so merging is a plain sort. `id` breaks ties, making
    // the order stable across identical queries. The key is internal and stripped before returning.
    const ranked = [
      ...toResults(experiments.value, "experiment", () => null),
      ...toResults(protocols.value, "protocol", (p) => p.family),
      ...toResults(macros.value, "macro", (m) => m.language),
      ...toResults(workbooks.value, "workbook", () => null),
      ...toResults(organizations.value, "organization", (o) => o.type),
    ]
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, limit);

    const results: SearchResult[] = ranked.map(({ score: _score, ...result }) => result);

    return success({ results });
  }
}

/** A `SearchResult` plus the cross-type sort key carried out of the repositories. */
type RankedResult = SearchResult & { score: number };

/** `meta` extracts the optional type-specific label shown beside the title (language / family). */
function toResults<T extends SearchableEntity>(
  rows: T[],
  type: SearchResultType,
  meta: (row: T) => string | null,
): RankedResult[] {
  return rows.map((row) => ({
    type,
    id: row.id,
    title: row.name,
    subtitle: row.description,
    meta: meta(row),
    score: row.score,
  }));
}
