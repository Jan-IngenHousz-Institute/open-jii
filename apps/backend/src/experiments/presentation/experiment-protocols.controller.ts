import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { SessionUser } from "@repo/auth/config";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { handleFailure } from "../../common/utils/fp-utils";
import { AddExperimentProtocolsUseCase } from "../application/use-cases/experiment-protocols/add-experiment-protocols";
import { ListExperimentProtocolsUseCase } from "../application/use-cases/experiment-protocols/list-experiment-protocols";
import { RemoveExperimentProtocolUseCase } from "../application/use-cases/experiment-protocols/remove-experiment-protocol";

function isProtocolFamily(family: unknown): family is "multispeq" | "ambit" {
  return family === "multispeq" || family === "ambit";
}

@Controller()
@UseGuards(AuthGuard)
export class ExperimentProtocolsController {
  private readonly logger = new Logger(ExperimentProtocolsController.name);

  constructor(
    private readonly listExperimentProtocolsUseCase: ListExperimentProtocolsUseCase,
    private readonly addExperimentProtocolsUseCase: AddExperimentProtocolsUseCase,
    private readonly removeExperimentProtocolUseCase: RemoveExperimentProtocolUseCase,
  ) {}

  @TsRestHandler(contract.protocols.listExperimentProtocols)
  listProtocols(@CurrentUser() user: SessionUser) {
    return tsRestHandler(contract.protocols.listExperimentProtocols, async ({ params }) => {
      const result = await this.listExperimentProtocolsUseCase.execute(params.id, user.id);

      if (result.isSuccess()) {
        const serialized = result.value.map((assoc) => {
          const family = assoc.protocol.family;
          if (!isProtocolFamily(family)) {
            throw new Error('Protocol family must be "multispeq" or "ambit"');
          }
          return {
            ...assoc,
            addedAt: assoc.addedAt instanceof Date ? assoc.addedAt.toISOString() : assoc.addedAt,
            protocol: {
              ...assoc.protocol,
              family,
            },
          };
        });
        return {
          status: StatusCodes.OK as const,
          body: serialized,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.protocols.addExperimentProtocols)
  addProtocols(@CurrentUser() user: SessionUser) {
    return tsRestHandler(contract.protocols.addExperimentProtocols, async ({ params, body }) => {
      const result = await this.addExperimentProtocolsUseCase.execute(
        params.id,
        body.protocols,
        user.id,
      );

      if (result.isSuccess()) {
        this.logger.log(
          `Protocols [${body.protocols.map((p) => p.protocolId).join(", ")}] added to experiment ${params.id} by user ${user.id}`,
        );
        const serialized = result.value.map((assoc) => {
          const family = assoc.protocol.family;
          if (!isProtocolFamily(family)) {
            throw new Error('Protocol family must be "multispeq" or "ambit"');
          }
          return {
            ...assoc,
            addedAt: assoc.addedAt instanceof Date ? assoc.addedAt.toISOString() : assoc.addedAt,
            protocol: {
              ...assoc.protocol,
              family,
            },
          };
        });
        return {
          status: StatusCodes.CREATED as const,
          body: serialized,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.protocols.removeExperimentProtocol)
  removeProtocol(@CurrentUser() user: SessionUser) {
    return tsRestHandler(contract.protocols.removeExperimentProtocol, async ({ params }) => {
      const result = await this.removeExperimentProtocolUseCase.execute(
        params.id,
        params.protocolId,
        user.id,
      );

      if (result.isSuccess()) {
        this.logger.log(
          `Protocol ${params.protocolId} removed from experiment ${params.id} by user ${user.id}`,
        );
        return {
          status: StatusCodes.NO_CONTENT,
          body: null,
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
