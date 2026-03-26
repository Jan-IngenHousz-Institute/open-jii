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

    // Check that at least one version exists
    const protocolResult = await this.protocolRepository.findOne(id);

    if (protocolResult.isFailure()) {
      return protocolResult;
    }

    if (!protocolResult.value) {
      this.logger.warn({
        msg: "Protocol not found",
        errorCode: ErrorCodes.PROTOCOL_NOT_FOUND,
        operation: "listProtocolVersions",
        protocolId: id,
      });
      return failure(AppError.notFound(`Protocol with ID ${id} not found`));
    }

    // Return all versions by id
    return this.protocolRepository.findVersionsById(id);
  }
}
