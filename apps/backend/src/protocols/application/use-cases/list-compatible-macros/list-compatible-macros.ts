import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { ProtocolMacroDto } from "../../../core/models/protocol-macros.model";
import { ProtocolMacroRepository } from "../../../core/repositories/protocol-macro.repository";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

@Injectable()
export class ListCompatibleMacrosUseCase {
  private readonly logger = new Logger(ListCompatibleMacrosUseCase.name);

  constructor(
    private readonly protocolRepository: ProtocolRepository,
    private readonly protocolMacroRepository: ProtocolMacroRepository,
  ) {}

  async execute(protocolId: string): Promise<Result<ProtocolMacroDto[]>> {
    this.logger.log({
      msg: "Listing compatible macros for protocol",
      operation: "listCompatibleMacros",
      protocolId,
    });

    const protocolResult = await this.protocolRepository.findOne(protocolId);
    if (protocolResult.isFailure()) {
      return failure(AppError.internal("Failed to fetch protocol"));
    }
    if (!protocolResult.value) {
      return failure(AppError.notFound(`Protocol with ID ${protocolId} not found`));
    }

    const result = await this.protocolMacroRepository.listMacros(protocolId);
    if (result.isFailure()) {
      this.logger.error({
        msg: "Failed to list compatible macros",
        errorCode: ErrorCodes.PROTOCOL_MACROS_LIST_FAILED,
        operation: "listCompatibleMacros",
        protocolId,
      });
      return failure(AppError.internal("Failed to list compatible macros"));
    }

    return result;
  }
}
