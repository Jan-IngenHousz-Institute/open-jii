import { Injectable, Logger } from "@nestjs/common";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import type { EntitySnapshots } from "@repo/api/domains/workbook/workbook-version.schema";

import { AuthorizationService } from "../../../../authorization/authorization.service";
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
    private readonly authz: AuthorizationService,
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

    // Minting a version snapshots the workbook's cells into durable, later-
    // readable state, so the publisher must be able to read the workbook itself
    // — not just the entities its cells reference (checked below). This is the
    // choke point for every minting caller (attach/upgrade/transfer), so a
    // revoked grantee cannot capture post-revocation workbook state through a
    // path that only authorized some other resource.
    const workbookAccess = await this.authz.can(userId, {
      resourceType: "workbook",
      resourceId: workbookId,
      action: "read",
    });
    if (!workbookAccess.allow) {
      this.logger.warn({
        msg: "Publish denied: no read access to the workbook",
        operation: "publishVersion",
        workbookId,
        userId,
        reason: workbookAccess.reason,
      });
      return failure(
        workbookAccess.reason === "not-found"
          ? AppError.notFound(`Workbook with ID ${workbookId} not found`)
          : AppError.forbidden("You do not have access to this workbook"),
      );
    }

    const latestResult = await this.workbookVersionRepository.getLatestVersion(workbookId);
    if (latestResult.isFailure()) return latestResult;
    const nextVersion = latestResult.value ? latestResult.value.version + 1 : 1;

    const cells = workbook.cells as WorkbookCell[];
    const protocolIds = [
      ...new Set(cells.flatMap((c) => (c.type === "protocol" ? [c.payload.protocolId] : []))),
    ];
    const macroIds = [
      ...new Set(cells.flatMap((c) => (c.type === "macro" ? [c.payload.macroId] : []))),
    ];

    // A version snapshots the full code of every referenced protocol/macro, and
    // the snapshot is later readable through the workbook. Cells can reference
    // arbitrary UUIDs, so a caller could otherwise exfiltrate a private
    // macro/protocol's code by referencing its UUID. Verify the publishing user
    // can `read` each referenced entity and fail closed when one exists but is
    // inaccessible (`forbidden`). A dangling ref (`not-found`) is tolerated as
    // before — there is no code to snapshot and nothing to leak.
    //
    // The checks are independent and read-only, so run the (deduped) set in
    // parallel — a large workbook would otherwise serialize hundreds of
    // multi-query authorization checks.
    const refChecks = await Promise.all([
      ...protocolIds.map((id) =>
        this.authz
          .can(userId, { resourceType: "protocol", resourceId: id, action: "read" })
          .then((decision) => ({ kind: "protocol" as const, id, decision })),
      ),
      ...macroIds.map((id) =>
        this.authz
          .can(userId, { resourceType: "macro", resourceId: id, action: "read" })
          .then((decision) => ({ kind: "macro" as const, id, decision })),
      ),
    ]);
    const denied = refChecks.find((r) => !r.decision.allow && r.decision.reason !== "not-found");
    if (denied) {
      return failure(
        AppError.forbidden(
          `Cannot publish: no read access to referenced ${denied.kind} ${denied.id}`,
        ),
      );
    }

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
