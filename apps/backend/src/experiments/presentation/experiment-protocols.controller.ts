import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { User } from "@repo/auth/types";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { formatDatesList } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
import { AddExperimentProtocolsUseCase } from "../application/use-cases/experiment-protocols/add-experiment-protocols";
import { ListExperimentProtocolsUseCase } from "../application/use-cases/experiment-protocols/list-experiment-protocols";
import { RemoveExperimentProtocolUseCase } from "../application/use-cases/experiment-protocols/remove-experiment-protocol";

@Controller()
@UseGuards(AuthGuard)
export class ExperimentProtocolsController {
  private readonly logger = new Logger(ExperimentProtocolsController.name);

  constructor(
    private readonly listExperimentProtocolsUseCase: ListExperimentProtocolsUseCase,
    private readonly addExperimentProtocolsUseCase: AddExperimentProtocolsUseCase,
    private readonly removeExperimentProtocolUseCase: RemoveExperimentProtocolUseCase,
  ) {}

  @TsRestHandler(contract.experiments.listExperimentProtocols)
  listProtocols(@CurrentUser() user: User) {
    return tsRestHandler(contract.experiments.listExperimentProtocols, async ({ params }) => {
      const result = await this.listExperimentProtocolsUseCase.execute(params.id, user.id);

      if (result.isSuccess()) {
        const protocols = formatDatesList(result.value);
        return {
          status: StatusCodes.OK as const,
          body: protocols,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.addExperimentProtocols)
  addProtocols(@CurrentUser() user: User) {
    return tsRestHandler(contract.experiments.addExperimentProtocols, async ({ params, body }) => {
      const result = await this.addExperimentProtocolsUseCase.execute(
        params.id,
        body.protocols,
        user.id,
      );

      if (result.isSuccess()) {
        const protocols = formatDatesList(result.value);
        return {
          status: StatusCodes.CREATED as const,
          body: protocols,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.experiments.removeExperimentProtocol)
  removeProtocol(@CurrentUser() user: User) {
    return tsRestHandler(contract.experiments.removeExperimentProtocol, async ({ params }) => {
      const result = await this.removeExperimentProtocolUseCase.execute(
        params.id,
        params.protocolId,
        user.id,
      );

      if (result.isSuccess()) {
        return {
          status: StatusCodes.NO_CONTENT,
          body: null,
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
