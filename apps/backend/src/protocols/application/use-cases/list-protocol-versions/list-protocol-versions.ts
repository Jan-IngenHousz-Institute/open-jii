import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, AppError } from "../../../../common/utils/fp-utils";
import { ProtocolDto } from "../../../core/models/protocol.model";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

@Injectable()
export class ListProtocolVersionsUseCase {
  private readonly logger = new Logger(ListProtocolVersionsUseCase.name);

  constructor(private readonly protocolRepository: ProtocolRepository) {}

  async execute(id: string): Promise<Result<ProtocolDto[]>> {
    this.logger.log({
      msg: "Listing protocol versions",
      operation: "listProtocolVersions",
      protocolId: id,
    });

    // First find the protocol to get its name
    const protocolResult = await this.protocolRepository.findOne(id);

    if (protocolResult.isFailure()) {
      return protocolResult;
    }

    const protocol = protocolResult.value;
    if (!protocol) {
      this.logger.warn({
        msg: "Protocol not found",
        errorCode: ErrorCodes.PROTOCOL_NOT_FOUND,
        operation: "listProtocolVersions",
        protocolId: id,
      });
      return failure(AppError.notFound(`Protocol with ID ${id} not found`));
    }

    // Return all versions with the same name
    return this.protocolRepository.findVersionsByName(protocol.name);
  }
}
