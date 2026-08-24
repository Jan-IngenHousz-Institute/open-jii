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
      language: filter?.language,
      hasSearch: !!filter?.search,
    });
    return await this.macroRepository.findAll(filter);
  }

  async executePaginated(
    page: number,
    pageSize: number,
    filter?: MacroFilter,
  ): Promise<Result<{ items: MacroDto[]; totalCount: number }>> {
    this.logger.log({
      msg: "Listing macros",
      operation: "listMacrosPaginated",
      page,
      pageSize,
      language: filter?.language,
      hasSearch: !!filter?.search,
    });
    return await this.macroRepository.findPage(page, pageSize, filter);
  }
}
