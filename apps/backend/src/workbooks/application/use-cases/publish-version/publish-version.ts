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

    // Snapshot the exact PINNED version of every referenced entity, keyed by id + version,
    // so a workbook that pins two versions of the same macro/protocol keeps both. An attached
    // experiment then captures what each cell pinned rather than the drifting head.
    const macroPins = new Map<string, Set<number>>();
    const protocolPins = new Map<string, Set<number>>();
    const addPin = (pins: Map<string, Set<number>>, id: string, version: number) => {
      const versions = pins.get(id) ?? new Set<number>();
      versions.add(version);
      pins.set(id, versions);
    };
    for (const c of cells) {
      if (c.type === "macro") addPin(macroPins, c.payload.macroId, c.payload.version);
      if (c.type === "protocol") addPin(protocolPins, c.payload.protocolId, c.payload.version);
    }

    const entitySnapshots: EntitySnapshots = { protocols: {}, macros: {} };

    // Resolve every pinned (id, version) in parallel. A pinned version row must exist, or we
    // fail rather than publish a silently incomplete snapshot.
    const macroPairs = [...macroPins].flatMap(([id, vs]) =>
      [...vs].map((version) => ({ id, version })),
    );
    const protocolPairs = [...protocolPins].flatMap(([id, vs]) =>
      [...vs].map((version) => ({ id, version })),
    );
    const [macroLookups, protocolLookups] = await Promise.all([
      Promise.all(macroPairs.map((p) => this.macroRepository.findScriptByVersion(p.id, p.version))),
      Promise.all(protocolPairs.map((p) => this.protocolRepository.findVersion(p.id, p.version))),
    ]);

    for (let i = 0; i < macroPairs.length; i++) {
      const { id, version } = macroPairs[i];
      const result = macroLookups[i];
      if (result.isFailure()) return result;
      if (!result.value) {
        return failure(AppError.notFound(`Pinned macro version not found: ${id} v${version}`));
      }
      entitySnapshots.macros[id] = {
        ...entitySnapshots.macros[id],
        [version]: { code: result.value.code },
      };
    }
    for (let i = 0; i < protocolPairs.length; i++) {
      const { id, version } = protocolPairs[i];
      const result = protocolLookups[i];
      if (result.isFailure()) return result;
      if (!result.value) {
        return failure(AppError.notFound(`Pinned protocol version not found: ${id} v${version}`));
      }
      entitySnapshots.protocols[id] = {
        ...entitySnapshots.protocols[id],
        [version]: { code: result.value.code },
      };
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
