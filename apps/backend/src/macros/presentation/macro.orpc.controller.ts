import { Controller, Inject, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { FEATURE_FLAGS } from "@repo/analytics";
import { macroOrpcContract } from "@repo/api/domains/macro/macro.orpc";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { AppError, isSuccess } from "../../common/utils/fp-utils";
import { throwOrpcError, throwOrpcFailure } from "../../common/utils/orpc-fp";
import { AddCompatibleProtocolsUseCase } from "../application/use-cases/add-compatible-protocols/add-compatible-protocols";
import { CreateMacroUseCase } from "../application/use-cases/create-macro/create-macro";
import { DeleteMacroUseCase } from "../application/use-cases/delete-macro/delete-macro";
import { ExecuteMacroUseCase } from "../application/use-cases/execute-macro/execute-macro";
import { GetMacroUseCase } from "../application/use-cases/get-macro/get-macro";
import { ListCompatibleProtocolsUseCase } from "../application/use-cases/list-compatible-protocols/list-compatible-protocols";
import { ListMacrosUseCase } from "../application/use-cases/list-macros/list-macros";
import { RemoveCompatibleProtocolUseCase } from "../application/use-cases/remove-compatible-protocol/remove-compatible-protocol";
import { UpdateMacroUseCase } from "../application/use-cases/update-macro/update-macro";
import { ANALYTICS_PORT } from "../core/ports/analytics.port";
import type { AnalyticsPort } from "../core/ports/analytics.port";

@Controller()
export class MacroOrpcController {
  private readonly logger = new Logger(MacroOrpcController.name);

  constructor(
    @Inject(ANALYTICS_PORT)
    private readonly analyticsPort: AnalyticsPort,
    private readonly createMacroUseCase: CreateMacroUseCase,
    private readonly executeMacroUseCase: ExecuteMacroUseCase,
    private readonly getMacroUseCase: GetMacroUseCase,
    private readonly listMacrosUseCase: ListMacrosUseCase,
    private readonly updateMacroUseCase: UpdateMacroUseCase,
    private readonly deleteMacroUseCase: DeleteMacroUseCase,
    private readonly listCompatibleProtocolsUseCase: ListCompatibleProtocolsUseCase,
    private readonly addCompatibleProtocolsUseCase: AddCompatibleProtocolsUseCase,
    private readonly removeCompatibleProtocolUseCase: RemoveCompatibleProtocolUseCase,
  ) {}

  @Implement(macroOrpcContract.createMacro)
  createMacro(@Session() session: UserSession) {
    return implement(macroOrpcContract.createMacro).handler(async ({ input }) => {
      const result = await this.createMacroUseCase.execute(input, session.user.id);
      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(macroOrpcContract.getMacro)
  getMacro() {
    return implement(macroOrpcContract.getMacro).handler(async ({ input }) => {
      const result = await this.getMacroUseCase.execute(input.id);
      if (isSuccess(result)) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(macroOrpcContract.listMacros)
  listMacros(@Session() session: UserSession) {
    return implement(macroOrpcContract.listMacros).handler(async ({ input }) => {
      const result = await this.listMacrosUseCase.execute({
        search: input.search,
        language: input.language,
        filter: input.filter,
        userId: session.user.id,
      });
      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(macroOrpcContract.updateMacro)
  updateMacro(@Session() session: UserSession) {
    return implement(macroOrpcContract.updateMacro).handler(async ({ input }) => {
      const { id, ...body } = input;
      const result = await this.updateMacroUseCase.execute(id, body, session.user.id);
      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(macroOrpcContract.executeMacro)
  executeMacro() {
    return implement(macroOrpcContract.executeMacro).handler(async ({ input }) => {
      const { id, ...body } = input;
      const result = await this.executeMacroUseCase.execute(id, body);
      if (result.isSuccess()) {
        return result.value;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(macroOrpcContract.deleteMacro)
  deleteMacro(@Session() session: UserSession) {
    return implement(macroOrpcContract.deleteMacro).handler(async ({ input }) => {
      const isDeletionEnabled = await this.analyticsPort.isFeatureFlagEnabled(
        FEATURE_FLAGS.MACRO_DELETION,
        session.user.email || session.user.id,
      );

      if (!isDeletionEnabled) {
        return throwOrpcError(
          AppError.forbidden("Macro deletion is currently disabled"),
          this.logger,
          "deleteMacro",
        );
      }

      const result = await this.deleteMacroUseCase.execute(input.id, session.user.id);
      if (result.isSuccess()) {
        return undefined;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(macroOrpcContract.listCompatibleProtocols)
  listCompatibleProtocols() {
    return implement(macroOrpcContract.listCompatibleProtocols).handler(async ({ input }) => {
      const result = await this.listCompatibleProtocolsUseCase.execute(input.id);
      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(macroOrpcContract.addCompatibleProtocols)
  addCompatibleProtocols(@Session() session: UserSession) {
    return implement(macroOrpcContract.addCompatibleProtocols).handler(async ({ input }) => {
      const result = await this.addCompatibleProtocolsUseCase.execute(
        input.id,
        input.protocolIds,
        session.user.id,
      );
      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(macroOrpcContract.removeCompatibleProtocol)
  removeCompatibleProtocol(@Session() session: UserSession) {
    return implement(macroOrpcContract.removeCompatibleProtocol).handler(async ({ input }) => {
      const result = await this.removeCompatibleProtocolUseCase.execute(
        input.id,
        input.protocolId,
        session.user.id,
      );
      if (result.isSuccess()) {
        return undefined;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }
}
