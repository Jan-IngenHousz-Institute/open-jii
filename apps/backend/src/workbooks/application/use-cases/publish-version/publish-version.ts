import { Injectable, Logger } from "@nestjs/common";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import type { EntitySnapshots } from "@repo/api/schemas/workbook-version.schema";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { MacroRepository } from "../../../../macros/core/repositories/macro.repository";
import { ProtocolRepository } from "../../../../protocols/core/repositories/protocol.repository";
import type { WorkbookVersionDto } from "../../../core/models/workbook-version.model";
import { WorkbookVersionRepository } from "../../../core/repositories/workbook-version.repository";
import { WorkbookRepository } from "../../../core/repositories/workbook.repository";

@Injectable()
export class PublishVersionUseCase {
  private readonly logger = new Logger(PublishVersionUseCase.name);

  constructor(
    private readonly workbookRepository: WorkbookRepository,
    private readonly workbookVersionRepository: WorkbookVersionRepository,
    private readonly protocolRepository: ProtocolRepository,
    private readonly macroRepository: MacroRepository,
  ) {}

  // Always mints a new version. Callers gate via IsWorkbookUpgradableUseCase; reuse the latest if undrifted.
  async execute(workbookId: string, userId: string): Promise<Result<WorkbookVersionDto>> {
    const workbookResult = await this.workbookRepository.findById(workbookId);
    if (workbookResult.isFailure()) return workbookResult;

    const workbook = workbookResult.value;
    if (!workbook) {
      this.logger.warn({
        msg: "Workbook not found for publishing",
        errorCode: ErrorCodes.WORKBOOK_NOT_FOUND,
        operation: "publishVersion",
        workbookId,
      });
      return failure(AppError.notFound(`Workbook with ID ${workbookId} not found`));
    }

    const latestResult = await this.workbookVersionRepository.getLatestVersion(workbookId);
    if (latestResult.isFailure()) return latestResult;
    const nextVersion = latestResult.value ? latestResult.value.version + 1 : 1;

    const cells = workbook.cells as WorkbookCell[];

    // Snapshot the exact PINNED version of each referenced entity, so an attached
    // experiment captures what the cells pinned rather than whatever the head later
    // becomes. (Snapshots are keyed by entity id; if two cells pin different versions
    // of the same entity, the last wins — matching the pre-existing id-keyed model.)
    // entitySnapshots is keyed by entity id, so it holds one code per entity. If two cells
    // pin DIFFERENT versions of the same entity, the snapshot can only keep one — warn and
    // keep the highest pinned version. (Full multi-version snapshots would require re-keying
    // the snapshot shape by entity id + version.)
    const macroPins = new Map<string, number>();
    const protocolPins = new Map<string, number>();
    const noteConflict = (kind: string, entityId: string, prev: number, next: number) =>
      this.logger.warn({
        msg: "Workbook pins two versions of the same entity; snapshot keeps the highest",
        operation: "publishVersion",
        workbookId,
        kind,
        entityId,
        versions: [prev, next],
      });
    for (const c of cells) {
      if (c.type === "macro") {
        const prev = macroPins.get(c.payload.macroId);
        if (prev !== undefined && prev !== c.payload.version) {
          noteConflict("macro", c.payload.macroId, prev, c.payload.version);
        }
        macroPins.set(c.payload.macroId, Math.max(prev ?? 0, c.payload.version));
      }
      if (c.type === "protocol") {
        const prev = protocolPins.get(c.payload.protocolId);
        if (prev !== undefined && prev !== c.payload.version) {
          noteConflict("protocol", c.payload.protocolId, prev, c.payload.version);
        }
        protocolPins.set(c.payload.protocolId, Math.max(prev ?? 0, c.payload.version));
      }
    }

    const macrosResult = await this.macroRepository.findScriptsByPins(
      [...macroPins].map(([macroId, version]) => ({ macroId, version })),
    );
    if (macrosResult.isFailure()) return macrosResult;

    const entitySnapshots: EntitySnapshots = { protocols: {}, macros: {} };
    for (const [id, m] of macrosResult.value) {
      entitySnapshots.macros[id] = { code: m.code };
    }
    // Fall back to head code for any pinned macro whose version row is missing, so the
    // snapshot is never silently incomplete.
    const missingMacroIds = [...macroPins.keys()].filter((id) => !(id in entitySnapshots.macros));
    if (missingMacroIds.length > 0) {
      const headScripts = await this.macroRepository.findScriptsByIds(missingMacroIds);
      if (headScripts.isFailure()) return headScripts;
      for (const [id, m] of headScripts.value) {
        entitySnapshots.macros[id] = { code: m.code };
      }
    }
    for (const [protocolId, version] of protocolPins) {
      const versionResult = await this.protocolRepository.findVersion(protocolId, version);
      if (versionResult.isFailure()) return versionResult;
      if (versionResult.value) {
        entitySnapshots.protocols[protocolId] = { code: versionResult.value.code };
      } else {
        const headResult = await this.protocolRepository.findOne(protocolId);
        if (headResult.isFailure()) return headResult;
        if (headResult.value) {
          entitySnapshots.protocols[protocolId] = { code: headResult.value.code };
        }
      }
    }

    this.logger.log({
      msg: "Publishing new workbook version",
      operation: "publishVersion",
      workbookId,
      version: nextVersion,
    });

    const createResult = await this.workbookVersionRepository.create({
      workbookId,
      version: nextVersion,
      cells: workbook.cells,
      metadata: workbook.metadata,
      entitySnapshots,
      createdBy: userId,
    });

    if (createResult.isFailure()) {
      this.logger.error({
        msg: "Failed to create workbook version",
        errorCode: ErrorCodes.WORKBOOK_VERSION_CREATE_FAILED,
        operation: "publishVersion",
        workbookId,
        version: nextVersion,
      });
    }

    return createResult;
  }
}
