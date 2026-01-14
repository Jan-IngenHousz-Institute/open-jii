import { Injectable, Logger } from "@nestjs/common";

import { Result } from "../../../../common/utils/fp-utils";
import { MacroDto } from "../../../core/models/macro.model";
import { MacroRepository, MacroFilter } from "../../../core/repositories/macro.repository";

@Injectable()
export class ListMacrosUseCase {
  private readonly logger = new Logger(ListMacrosUseCase.name);

  constructor(private readonly macroRepository: MacroRepository) {}

  async execute(filter?: MacroFilter): Promise<Result<MacroDto[]>> {
    this.logger.log({
      msg: "Listing macros",
      operation: "listMacros",
      context: ListMacrosUseCase.name,
      language: filter?.language,
      hasSearch: !!filter?.search,
    });
    return await this.macroRepository.findAll(filter);
  }
}
