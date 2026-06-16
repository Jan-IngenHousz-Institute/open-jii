import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { MacroRepository } from "../../../../macros/core/repositories/macro.repository";
import { ProtocolRepository } from "../../../../protocols/core/repositories/protocol.repository";
import { WorkbookDto } from "../../../core/models/workbook.model";
import { WorkbookRepository } from "../../../core/repositories/workbook.repository";
import { IsWorkbookUpgradableUseCase } from "../is-workbook-upgradable/is-workbook-upgradable";

@Injectable()
export class GetWorkbookUseCase {
  private readonly logger = new Logger(GetWorkbookUseCase.name);

  constructor(
    private readonly workbookRepository: WorkbookRepository,
    private readonly isWorkbookUpgradableUseCase: IsWorkbookUpgradableUseCase,
    private readonly macroRepository: MacroRepository,
    private readonly protocolRepository: ProtocolRepository,
  ) {}

  async execute(id: string, _userId: string): Promise<Result<WorkbookDto>> {
    this.logger.log({
      msg: "Getting workbook",
      operation: "getWorkbook",
      workbookId: id,
    });

    const result = await this.workbookRepository.findById(id);

    if (result.isFailure()) {
      return result;
    }

    if (!result.value) {
      this.logger.warn({
        msg: "Workbook not found",
        errorCode: ErrorCodes.WORKBOOK_NOT_FOUND,
        operation: "getWorkbook",
        workbookId: id,
      });
      return failure(AppError.notFound("Workbook not found"));
    }

    const isUpgradableResult = await this.isWorkbookUpgradableUseCase.execute(result.value);

    if (isUpgradableResult.isFailure()) {
      return isUpgradableResult;
    }

    const workbook = result.value;

    // Authoring-side drift: does any cell pin a macro/protocol version below its latest?
    const macroPins = workbook.cells.flatMap((c) =>
      c.type === "macro" ? [{ id: c.payload.macroId, version: c.payload.version }] : [],
    );
    const protocolPins = workbook.cells.flatMap((c) =>
      c.type === "protocol" ? [{ id: c.payload.protocolId, version: c.payload.version }] : [],
    );

    const [macroLatest, protocolLatest] = await Promise.all([
      this.macroRepository.findLatestVersions(macroPins.map((p) => p.id)),
      this.protocolRepository.findLatestVersions(protocolPins.map((p) => p.id)),
    ]);
    if (macroLatest.isFailure()) return macroLatest;
    if (protocolLatest.isFailure()) return protocolLatest;

    const hasOutdatedEntities =
      macroPins.some((p) => (macroLatest.value.get(p.id) ?? p.version) > p.version) ||
      protocolPins.some((p) => (protocolLatest.value.get(p.id) ?? p.version) > p.version);

    return success({
      ...workbook,
      isUpgradable: isUpgradableResult.value,
      hasOutdatedEntities,
    });
  }
}
