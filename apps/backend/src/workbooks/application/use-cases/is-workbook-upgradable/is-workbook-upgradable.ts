import { Injectable, Logger } from "@nestjs/common";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

import { Result, success } from "../../../../common/utils/fp-utils";
import { MacroRepository } from "../../../../macros/core/repositories/macro.repository";
import { ProtocolRepository } from "../../../../protocols/core/repositories/protocol.repository";
import { WorkbookDto } from "../../../core/models/workbook.model";
import { WorkbookVersionRepository } from "../../../core/repositories/workbook-version.repository";

const RUNTIME_FIELDS = new Set([
  "isCollapsed",
  "isAnswered",
  "answer",
  "evaluatedPathId",
  "data",
  "executionTime",
  "messages",
]);

// Output cells are runtime artifacts produced by execution; they are not part
// of the workbook's design and must not register as "upgradable" drift.
const designOf = (cells: WorkbookCell[]) =>
  cells
    .filter((cell) => cell.type !== "output")
    .map((cell) =>
      Object.fromEntries(Object.entries(cell).filter(([k]) => !RUNTIME_FIELDS.has(k))),
    );

@Injectable()
export class IsWorkbookUpgradableUseCase {
  private readonly logger = new Logger(IsWorkbookUpgradableUseCase.name);

  constructor(
    private readonly workbookVersionRepository: WorkbookVersionRepository,
    private readonly protocolRepository: ProtocolRepository,
    private readonly macroRepository: MacroRepository,
  ) {}

  async execute(workbook: WorkbookDto): Promise<Result<boolean>> {
    this.logger.log({
      msg: "Checking workbook upgradable",
      operation: "isWorkbookUpgradable",
      workbookId: workbook.id,
    });

    const latestResult = await this.workbookVersionRepository.getLatestVersion(workbook.id);
    if (latestResult.isFailure()) return latestResult;
    const latest = latestResult.value;
    if (!latest) return success(false);

    const cellsChanged =
      JSON.stringify(designOf(workbook.cells)) !==
      JSON.stringify(designOf(latest.cells as WorkbookCell[]));
    if (cellsChanged) return success(true);

    const protocolIds = [
      ...new Set(
        workbook.cells.flatMap((c) => (c.type === "protocol" ? [c.payload.protocolId] : [])),
      ),
    ];
    const macroIds = [
      ...new Set(workbook.cells.flatMap((c) => (c.type === "macro" ? [c.payload.macroId] : []))),
    ];

    const [protocolsResult, macrosResult] = await Promise.all([
      this.protocolRepository.findByIds(protocolIds),
      this.macroRepository.findScriptsByIds(macroIds),
    ]);
    if (protocolsResult.isFailure()) return protocolsResult;
    if (macrosResult.isFailure()) return macrosResult;

    const snapshots = latest.entitySnapshots;
    for (const [id, p] of protocolsResult.value) {
      const snap = snapshots.protocols[id] as { code: unknown } | undefined;
      if (JSON.stringify(snap?.code) !== JSON.stringify(p.code)) return success(true);
    }
    for (const [id, m] of macrosResult.value) {
      const snap = snapshots.macros[id] as { code: string } | undefined;
      if (snap?.code !== m.code) return success(true);
    }

    return success(false);
  }
}
