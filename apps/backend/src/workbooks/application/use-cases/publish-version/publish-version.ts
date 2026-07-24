import { Injectable, Logger } from "@nestjs/common";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import type { EntitySnapshots } from "@repo/api/domains/workbook/workbook-version.schema";
import {
  hasDynamicCommandRef,
  validateDynamicCommandReferences,
} from "@repo/api/transforms/dynamic-command-refs";

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

    const cells = workbook.cells as WorkbookCell[];

    // Structural validation is enforced HERE, before snapshots or version
    // creation, so direct-API, web, and future clients all publish under the
    // same rule. Runtime-only checks (freshness, scope, device, value) stay out.
    const structuralIssues = validateDynamicCommandReferences(cells);
    if (structuralIssues.length > 0) {
      this.logger.warn({
        msg: "Blocked publish: workbook has structural validation errors",
        errorCode: ErrorCodes.WORKBOOK_STRUCTURAL_VALIDATION_FAILED,
        operation: "publishVersion",
        workbookId,
        issueCodes: structuralIssues.map((i) => i.code),
      });
      return failure(
        AppError.badRequest(
          "Workbook has structural validation errors",
          ErrorCodes.WORKBOOK_STRUCTURAL_VALIDATION_FAILED,
          { issues: structuralIssues },
        ),
      );
    }

    // Default-off release gate. A dynamic-command workbook cannot be published
    // until DYNAMIC_COMMAND_PUBLISH_ENABLED=true, even if the web authoring flag
    // was flipped on prematurely. Static workbooks are unaffected.
    if (hasDynamicCommandRef(cells) && process.env.DYNAMIC_COMMAND_PUBLISH_ENABLED !== "true") {
      this.logger.warn({
        msg: "Blocked publish: dynamic command publication is disabled",
        errorCode: ErrorCodes.DYNAMIC_COMMAND_PUBLISH_DISABLED,
        operation: "publishVersion",
        workbookId,
      });
      return failure(
        AppError.badRequest(
          "Dynamic command publication is currently disabled",
          ErrorCodes.DYNAMIC_COMMAND_PUBLISH_DISABLED,
        ),
      );
    }

    const latestResult = await this.workbookVersionRepository.getLatestVersion(workbookId);
    if (latestResult.isFailure()) return latestResult;
    const nextVersion = latestResult.value ? latestResult.value.version + 1 : 1;

    const protocolIds = [
      ...new Set(cells.flatMap((c) => (c.type === "protocol" ? [c.payload.protocolId] : []))),
    ];
    const macroIds = [
      ...new Set(cells.flatMap((c) => (c.type === "macro" ? [c.payload.macroId] : []))),
    ];

    const [protocolsResult, macrosResult] = await Promise.all([
      this.protocolRepository.findByIds(protocolIds),
      this.macroRepository.findScriptsByIds(macroIds),
    ]);
    if (protocolsResult.isFailure()) return protocolsResult;
    if (macrosResult.isFailure()) return macrosResult;

    const entitySnapshots: EntitySnapshots = { protocols: {}, macros: {} };
    for (const [id, p] of protocolsResult.value) {
      entitySnapshots.protocols[id] = { code: p.code, family: p.family };
    }
    for (const [id, m] of macrosResult.value) {
      entitySnapshots.macros[id] = { code: m.code };
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
