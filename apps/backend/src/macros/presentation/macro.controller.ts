import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { macroContract } from "@repo/api";
import type { User } from "@repo/auth/types";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { handleFailure, isSuccess } from "../../common/utils/fp-utils";
import { CreateMacroUseCase } from "../application/use-cases/create-macro/create-macro";
import { DeleteMacroUseCase } from "../application/use-cases/delete-macro/delete-macro";
import { GetMacroUseCase } from "../application/use-cases/get-macro/get-macro";
import { ListMacrosUseCase } from "../application/use-cases/list-macros/list-macros";
import { UpdateMacroUseCase } from "../application/use-cases/update-macro/update-macro";

@Controller()
export class MacroController {
  private readonly logger = new Logger(MacroController.name);

  constructor(
    private readonly createMacroUseCase: CreateMacroUseCase,
    private readonly getMacroUseCase: GetMacroUseCase,
    private readonly listMacrosUseCase: ListMacrosUseCase,
    private readonly updateMacroUseCase: UpdateMacroUseCase,
    private readonly deleteMacroUseCase: DeleteMacroUseCase,
  ) {}

  @TsRestHandler(macroContract.createMacro)
  @UseGuards(AuthGuard)
  createMacro(@CurrentUser() user: User) {
    return tsRestHandler(macroContract.createMacro, async ({ body }) => {
      const result = await this.createMacroUseCase.execute(body, user.id);

      if (result.isSuccess()) {
        return {
          status: StatusCodes.CREATED,
          body: formatDates(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(macroContract.getMacro)
  @UseGuards(AuthGuard)
  getMacro() {
    return tsRestHandler(macroContract.getMacro, async ({ params }) => {
      const result = await this.getMacroUseCase.execute(params.id);

      if (isSuccess(result)) {
        return {
          status: StatusCodes.OK,
          body: formatDates(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(macroContract.listMacros)
  @UseGuards(AuthGuard)
  listMacros() {
    return tsRestHandler(macroContract.listMacros, async ({ query }) => {
      const result = await this.listMacrosUseCase.execute({
        search: query.search,
        language: query.language,
      });

      if (result.isSuccess()) {
        return {
          status: StatusCodes.OK,
          body: formatDatesList(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(macroContract.updateMacro)
  @UseGuards(AuthGuard)
  updateMacro(@CurrentUser() user: User) {
    return tsRestHandler(macroContract.updateMacro, async ({ params, body }) => {
      const result = await this.updateMacroUseCase.execute(params.id, body, user.id);

      if (result.isSuccess()) {
        return {
          status: StatusCodes.OK,
          body: formatDates(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(macroContract.deleteMacro)
  @UseGuards(AuthGuard)
  deleteMacro(@CurrentUser() user: User) {
    return tsRestHandler(macroContract.deleteMacro, async ({ params }) => {
      const result = await this.deleteMacroUseCase.execute(params.id, user.id);

      if (result.isSuccess()) {
        return {
          status: StatusCodes.NO_CONTENT,
          body: undefined,
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
