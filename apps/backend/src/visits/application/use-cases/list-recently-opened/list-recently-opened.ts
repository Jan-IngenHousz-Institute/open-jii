import { Injectable, Logger } from "@nestjs/common";

import { zVisitedResourceType } from "@repo/api/domains/visit/visit.schema";
import type { VisitedResourceType } from "@repo/api/domains/visit/visit.schema";

import { Result, failure, isFailure, success } from "../../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../../experiments/core/repositories/experiment.repository";
import type { RecentlyOpenedExperimentRow } from "../../../../experiments/core/repositories/experiment.repository";
import { MacroRepository } from "../../../../macros/core/repositories/macro.repository";
import type { RecentlyOpenedMacroRow } from "../../../../macros/core/repositories/macro.repository";
import { ProtocolRepository } from "../../../../protocols/core/repositories/protocol.repository";
import type { RecentlyOpenedProtocolRow } from "../../../../protocols/core/repositories/protocol.repository";
import { WorkbookRepository } from "../../../../workbooks/core/repositories/workbook.repository";
import type { RecentlyOpenedWorkbookRow } from "../../../../workbooks/core/repositories/workbook.repository";

export type RecentlyOpenedRow =
  | ({ type: "experiment" } & RecentlyOpenedExperimentRow)
  | ({ type: "protocol" } & RecentlyOpenedProtocolRow)
  | ({ type: "macro" } & RecentlyOpenedMacroRow)
  | ({ type: "workbook" } & RecentlyOpenedWorkbookRow);

export interface RecentlyOpenedResult {
  items: RecentlyOpenedRow[];
  types: VisitedResourceType[];
}

/**
 * The caller's opened resources of every type, newest visit first. Each type's own
 * repository applies its listing's access scope, so a row the caller can no longer
 * open never comes back.
 */
@Injectable()
export class ListRecentlyOpenedUseCase {
  private readonly logger = new Logger(ListRecentlyOpenedUseCase.name);

  constructor(
    private readonly experimentRepository: ExperimentRepository,
    private readonly protocolRepository: ProtocolRepository,
    private readonly macroRepository: MacroRepository,
    private readonly workbookRepository: WorkbookRepository,
  ) {}

  async execute(
    userId: string,
    limit: number,
    type?: VisitedResourceType,
  ): Promise<Result<RecentlyOpenedResult>> {
    this.logger.log({
      msg: "Listing recently opened resources",
      operation: "listRecentlyOpened",
      userId,
      limit,
      type,
    });

    // Every type is read even when one is asked for, because `types` reports them all.
    // The newest `limit` of each hold the newest `limit` overall.
    const [experiments, protocols, macros, workbooks] = await Promise.all([
      this.experimentRepository.findRecentlyOpened(userId, limit),
      this.protocolRepository.findRecentlyOpened(userId, limit),
      this.macroRepository.findRecentlyOpened(userId, limit),
      this.workbookRepository.findRecentlyOpened(userId, limit),
    ]);

    if (isFailure(experiments)) return failure(experiments.error);
    if (isFailure(protocols)) return failure(protocols.error);
    if (isFailure(macros)) return failure(macros.error);
    if (isFailure(workbooks)) return failure(workbooks.error);

    const byType: Record<VisitedResourceType, RecentlyOpenedRow[]> = {
      experiment: experiments.value.map((row) => ({ type: "experiment", ...row })),
      protocol: protocols.value.map((row) => ({ type: "protocol", ...row })),
      macro: macros.value.map((row) => ({ type: "macro", ...row })),
      workbook: workbooks.value.map((row) => ({ type: "workbook", ...row })),
    };

    const types = zVisitedResourceType.options.filter((option) => byType[option].length > 0);
    const items = (type ? byType[type] : Object.values(byType).flat())
      .sort((a, b) => b.openedAt.getTime() - a.openedAt.getTime())
      .slice(0, limit);

    return success({ items, types });
  }
}
