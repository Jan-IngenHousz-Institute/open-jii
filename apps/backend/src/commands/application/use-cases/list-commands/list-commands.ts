import { Injectable } from "@nestjs/common";

import { CommandFilter } from "@repo/api/schemas/command.schema";

import { Result } from "../../../../common/utils/fp-utils";
import { CommandDto } from "../../../core/models/command.model";
import { CommandRepository } from "../../../core/repositories/command.repository";

@Injectable()
export class ListCommandsUseCase {
  constructor(private readonly commandRepository: CommandRepository) {}

  async execute(
    search?: CommandFilter,
    filter?: "my",
    userId?: string,
  ): Promise<Result<CommandDto[]>> {
    return this.commandRepository.findAll(search, filter, userId);
  }
}
