import { Injectable } from "@nestjs/common";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

import { Result, success } from "../../../../common/utils/fp-utils";
import { WorkbookDto } from "../../../core/models/workbook.model";
import { WorkbookVersionRepository } from "../../../core/repositories/workbook-version.repository";

/** Fields that are part of a cell's runtime/UI state, not its design.
 *  Stripped before comparing so collapsing a cell or answering a question
 *  doesn't count as a workbook change. */
const RUNTIME_FIELDS = new Set([
  "isCollapsed",
  "isAnswered",
  "answer",
  "evaluatedPathId",
  "data",
  "executionTime",
  "messages",
]);

const designOf = (cells: WorkbookCell[]) =>
  cells.map((cell) =>
    Object.fromEntries(Object.entries(cell).filter(([k]) => !RUNTIME_FIELDS.has(k))),
  );

/** Decides whether a workbook's live cells differ from the latest
 *  published version's cells at the *design* level — i.e. whether
 *  publishing now would mint a new row vs. duplicate an existing one.
 *  Returns `false` when there are no versions yet (nothing to upgrade
 *  from); attach/upgrade callers handle that case explicitly. */
@Injectable()
export class IsWorkbookUpgradableUseCase {
  constructor(private readonly workbookVersionRepository: WorkbookVersionRepository) {}

  async execute(workbook: WorkbookDto): Promise<Result<boolean>> {
    const latestResult = await this.workbookVersionRepository.getLatestVersion(workbook.id);
    if (latestResult.isFailure()) return latestResult;
    const latest = latestResult.value;
    if (!latest) return success(false);

    return success(
      JSON.stringify(designOf(workbook.cells)) !==
        JSON.stringify(designOf(latest.cells as WorkbookCell[])),
    );
  }
}
