import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ProtocolDto } from "../../../core/models/protocol.model";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

@Injectable()
export class DeleteProtocolUseCase {
  private readonly logger = new Logger(DeleteProtocolUseCase.name);

  constructor(private readonly protocolRepository: ProtocolRepository) {}

  async execute(id: string): Promise<Result<ProtocolDto>> {
    this.logger.log(`Deleting protocol with ID "${id}"`);

    // Check if protocol exists
    const existingProtocolResult = await this.protocolRepository.findOne(id);

    if (existingProtocolResult.isFailure()) {
      return existingProtocolResult;
    }

    const protocol = existingProtocolResult.value;
    if (!protocol) {
      this.logger.warn(`Attempt to delete non-existent protocol with ID ${id}`);
      return failure(AppError.notFound(`Protocol not found`));
    }

    // Protocol exists, now delete it
    const deleteResult = await this.protocolRepository.delete(id);

    if (deleteResult.isFailure()) {
      return deleteResult;
    }

    const protocols = deleteResult.value;
    if (protocols.length === 0) {
      this.logger.error(`Failed to delete protocol with ID ${id}`);
      return failure(AppError.internal("Failed to delete protocol"));
    }

    this.logger.log(`Successfully deleted protocol with ID ${id}`);
    return success(protocols[0]);
  }
}
