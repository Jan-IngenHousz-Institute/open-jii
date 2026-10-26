import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ResourceDeletedNotifier } from "../../../../notifications/application/services/resource-deleted-notifier";
import { SharingRepository } from "../../../../sharing/core/repositories/sharing.repository";
import { ProtocolDto } from "../../../core/models/protocol.model";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

@Injectable()
export class DeleteProtocolUseCase {
  private readonly logger = new Logger(DeleteProtocolUseCase.name);

  constructor(
    private readonly protocolRepository: ProtocolRepository,
    private readonly sharingRepository: SharingRepository,
    private readonly deletionNotifier: ResourceDeletedNotifier,
  ) {}

  async execute(id: string, userId: string): Promise<Result<ProtocolDto>> {
    this.logger.log({
      msg: "Deleting protocol",
      operation: "deleteProtocol",
      protocolId: id,
      userId,
    });

    // Check if protocol exists
    const existingProtocolResult = await this.protocolRepository.findOne(id);

    if (existingProtocolResult.isFailure()) {
      return existingProtocolResult;
    }

    const protocol = existingProtocolResult.value;
    if (!protocol) {
      this.logger.warn({
        msg: "Attempt to delete non-existent protocol",
        errorCode: ErrorCodes.PROTOCOL_NOT_FOUND,
        operation: "deleteProtocol",
        protocolId: id,
      });
      return failure(AppError.notFound(`Protocol not found`));
    }

    const members = await this.sharingRepository.listMemberIds("protocol", id);

    // Protocol exists, now delete it
    const deleteResult = await this.protocolRepository.delete(id);

    if (deleteResult.isFailure()) {
      return deleteResult;
    }

    const protocols = deleteResult.value;
    if (protocols.length === 0) {
      this.logger.error({
        msg: "Failed to delete protocol",
        errorCode: ErrorCodes.PROTOCOL_DELETE_FAILED,
        operation: "execute",
        protocolId: id,
      });
      return failure(AppError.internal("Failed to delete protocol"));
    }

    await this.deletionNotifier.notify({
      operation: "deleteProtocol",
      actorId: userId,
      resource: { type: "protocol", id },
      name: protocol.name,
      members,
    });

    this.logger.log({
      msg: "Successfully deleted protocol",
      operation: "execute",
      protocolId: id,
      status: "success",
    });
    return success(protocols[0]);
  }
}
