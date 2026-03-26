import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { MacroProtocolDto } from "../../../core/models/macro-protocol.model";
import { MacroProtocolRepository } from "../../../core/repositories/macro-protocol.repository";
import { MacroRepository } from "../../../core/repositories/macro.repository";

@Injectable()
export class ListCompatibleProtocolsUseCase {
  private readonly logger = new Logger(ListCompatibleProtocolsUseCase.name);

  constructor(
    private readonly macroRepository: MacroRepository,
    private readonly macroProtocolRepository: MacroProtocolRepository,
  ) {}

  async execute(macroId: string, version?: number): Promise<Result<MacroProtocolDto[]>> {
    this.logger.log({
      msg: "Listing compatible protocols for macro",
      operation: "listCompatibleProtocols",
      macroId,
    });

    const macroResult = await this.macroRepository.findById(macroId, version);
    if (macroResult.isFailure()) {
      return failure(AppError.internal("Failed to fetch macro"));
    }
    if (!macroResult.value) {
      return failure(AppError.notFound(`Macro with ID ${macroId} not found`));
    }

    const macroVersion = macroResult.value.version;
    const result = await this.macroProtocolRepository.listProtocols(macroId, macroVersion);
    if (result.isFailure()) {
      this.logger.error({
        msg: "Failed to list compatible protocols",
        errorCode: ErrorCodes.MACRO_PROTOCOLS_LIST_FAILED,
        operation: "listCompatibleProtocols",
        macroId,
      });
      return failure(AppError.internal("Failed to list compatible protocols"));
    }

    return result;
  }
}
