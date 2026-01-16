import { Controller, Inject, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { FEATURE_FLAGS } from "@repo/analytics";
import { macroContract } from "@repo/api";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { handleFailure, isSuccess } from "../../common/utils/fp-utils";
import { CreateMacroUseCase } from "../application/use-cases/create-macro/create-macro";
import { DeleteMacroUseCase } from "../application/use-cases/delete-macro/delete-macro";
import { GetMacroUseCase } from "../application/use-cases/get-macro/get-macro";
import { ListMacrosUseCase } from "../application/use-cases/list-macros/list-macros";
import { UpdateMacroUseCase } from "../application/use-cases/update-macro/update-macro";
import { ANALYTICS_PORT } from "../core/ports/analytics.port";
import type { AnalyticsPort } from "../core/ports/analytics.port";

@Controller()
export class MacroController {
  private readonly logger = new Logger(MacroController.name);

  constructor(
    @Inject(ANALYTICS_PORT)
    private readonly analyticsPort: AnalyticsPort,
    private readonly createMacroUseCase: CreateMacroUseCase,
    private readonly getMacroUseCase: GetMacroUseCase,
    private readonly listMacrosUseCase: ListMacrosUseCase,
    private readonly updateMacroUseCase: UpdateMacroUseCase,
    private readonly deleteMacroUseCase: DeleteMacroUseCase,
  ) {}

  @TsRestHandler(macroContract.createMacro)
  createMacro(@Session() session: UserSession) {
    return tsRestHandler(macroContract.createMacro, async ({ body }) => {
      const result = await this.createMacroUseCase.execute(body, session.user.id);

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
  updateMacro(@Session() session: UserSession) {
    return tsRestHandler(macroContract.updateMacro, async ({ params, body }) => {
      const result = await this.updateMacroUseCase.execute(params.id, body, session.user.id);

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
  deleteMacro(@Session() session: UserSession) {
    return tsRestHandler(macroContract.deleteMacro, async ({ params }) => {
      const isDeletionEnabled = await this.analyticsPort.isFeatureFlagEnabled(
        FEATURE_FLAGS.MACRO_DELETION,
        session.user.email || session.user.id,
      );

      if (!isDeletionEnabled) {
        return {
          status: StatusCodes.FORBIDDEN,
          body: undefined,
        };
      }

      const result = await this.deleteMacroUseCase.execute(params.id, session.user.id);

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
