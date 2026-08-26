import { Injectable } from "@nestjs/common";

import { ProtocolFilter } from "@repo/api/domains/protocol/protocol.schema";
import type { ResourceScope } from "@repo/api/shared/listing";

import { Result } from "../../../../common/utils/fp-utils";
import { ProtocolDto } from "../../../core/models/protocol.model";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

@Injectable()
export class ListProtocolsUseCase {
  constructor(private readonly protocolRepository: ProtocolRepository) {}

  async execute(
    search?: ProtocolFilter,
    scope?: ResourceScope,
    userId?: string,
  ): Promise<Result<ProtocolDto[]>> {
    return this.protocolRepository.findAll(search, scope, userId);
  }

  async executePaginated(
    page: number,
    pageSize: number,
    search?: ProtocolFilter,
    scope?: ResourceScope,
    userId?: string,
  ): Promise<Result<{ items: ProtocolDto[]; totalCount: number }>> {
    return this.protocolRepository.findPage(page, pageSize, search, scope, userId);
  }
}
