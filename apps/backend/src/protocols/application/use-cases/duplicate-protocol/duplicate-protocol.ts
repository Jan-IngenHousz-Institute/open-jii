import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import type { ProtocolDto } from "../../../core/models/protocol.model";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

@Injectable()
export class DuplicateProtocolUseCase {
  private readonly logger = new Logger(DuplicateProtocolUseCase.name);

  constructor(private readonly protocolRepository: ProtocolRepository) {}

  async execute(
    protocolId: string,
    userId: string,
    nameOverride?: string,
  ): Promise<Result<ProtocolDto>> {
    const sourceResult = await this.protocolRepository.findOne(protocolId);
    if (sourceResult.isFailure()) {
      return sourceResult;
    }
    const source = sourceResult.value;
    if (!source) {
      return failure(AppError.notFound(`Protocol with ID ${protocolId} not found`));
    }

    const trimmed = nameOverride?.trim() ?? "";
    // Cap to leave room under the 255-char name limit for the " (N)" disambiguator suffix.
    const baseName = (trimmed.length > 0 ? trimmed : `Copy of ${source.name}`).slice(0, 240);

    // Probe for a free name, then insert. A concurrent duplicate can claim the name
    // between probe and insert (unique-index race), so retry on conflict: the next probe
    // sees the committed row and picks a fresh suffix.
    for (let attempt = 0; attempt < 5; attempt++) {
      const nameResult = await this.resolveUniqueName(baseName);
      if (nameResult.isFailure()) {
        return nameResult;
      }

      const created = await this.protocolRepository.create(
        {
          name: nameResult.value,
          description: source.description ?? undefined,
          code: source.code,
          family: source.family,
        },
        userId,
      );
      if (created.isFailure()) {
        if (created.error.code === "REPOSITORY_DUPLICATE") {
          continue;
        }
        return created;
      }
      if (created.value.length === 0) {
        return failure(AppError.internal("Failed to duplicate protocol"));
      }

      this.logger.log({
        msg: "Duplicated protocol",
        operation: "duplicateProtocol",
        sourceId: protocolId,
        newId: created.value[0].id,
        userId,
      });
      return success(created.value[0]);
    }

    return failure(
      AppError.conflict("Could not generate a unique name for the duplicated protocol"),
    );
  }

  /** Probe "Copy of X", "Copy of X (2)", … until the UNIQUE name constraint is free. */
  private async resolveUniqueName(base: string): Promise<Result<string>> {
    for (let i = 0; i < 50; i++) {
      const candidate = i === 0 ? base : `${base} (${i + 1})`;
      const existing = await this.protocolRepository.findByName(candidate);
      if (existing.isFailure()) {
        return existing;
      }
      if (!existing.value) {
        return success(candidate);
      }
    }
    return success(`${base} ${crypto.randomUUID().slice(0, 8)}`);
  }
}
