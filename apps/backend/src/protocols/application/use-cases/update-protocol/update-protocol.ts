import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { ProtocolDto, UpdateProtocolDto } from "../../../core/models/protocol.model";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

@Injectable()
export class UpdateProtocolUseCase {
  private readonly logger = new Logger(UpdateProtocolUseCase.name);

  constructor(private readonly protocolRepository: ProtocolRepository) {}

  async execute(
    id: string,
    updateProtocolDto: UpdateProtocolDto,
    userId: string,
  ): Promise<Result<ProtocolDto>> {
    this.logger.log({
      msg: "Updating protocol",
      operation: "updateProtocol",
      protocolId: id,
    });

    // Check if protocol exists
    const existingProtocolResult = await this.protocolRepository.findOne(id);

    if (existingProtocolResult.isFailure()) {
      return existingProtocolResult;
    }

    const protocol = existingProtocolResult.value;
    if (!protocol) {
      this.logger.warn({
        msg: "Attempt to update non-existent protocol",
        errorCode: ErrorCodes.PROTOCOL_NOT_FOUND,
        operation: "updateProtocol",
        protocolId: id,
      });
      return failure(AppError.notFound(`Protocol not found`));
    }

    // A code or family change mints a new immutable version (deduped against the
    // current head); metadata-only edits stay in place. Workbook cells stay pinned
    // to their version, so other workbooks are unaffected until they opt to upgrade.
    const codeChanged =
      updateProtocolDto.code !== undefined && updateProtocolDto.code !== protocol.code;
    const familyChanged =
      updateProtocolDto.family !== undefined && updateProtocolDto.family !== protocol.family;

    let updated: ProtocolDto;

    if (codeChanged || familyChanged) {
      // Mint the version and apply any accompanying name/description in one transaction.
      const mintResult = await this.protocolRepository.mintVersion(id, {
        code: updateProtocolDto.code ?? protocol.code,
        family: updateProtocolDto.family ?? protocol.family,
        createdBy: userId,
        name: updateProtocolDto.name,
        description: updateProtocolDto.description,
      });
      if (mintResult.isFailure()) {
        return mintResult;
      }
      updated = mintResult.value;
    } else {
      const updateResult = await this.protocolRepository.update(id, updateProtocolDto);
      if (updateResult.isFailure()) {
        return updateResult;
      }
      const protocols = updateResult.value;
      if (protocols.length === 0) {
        this.logger.error({
          msg: "Failed to update protocol",
          errorCode: ErrorCodes.PROTOCOL_UPDATE_FAILED,
          operation: "updateProtocol",
          protocolId: id,
        });
        return failure(AppError.internal("Failed to update protocol"));
      }
      updated = protocols[0];
    }

    this.logger.log({
      msg: "Protocol updated successfully",
      operation: "updateProtocol",
      protocolId: id,
      status: "success",
    });
    return success(updated);
  }
}
