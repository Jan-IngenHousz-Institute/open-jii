import { Injectable, Logger } from "@nestjs/common";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { ProtocolMacroDto } from "../../../core/models/protocol-macro.model";
import { ProtocolMacroRepository } from "../../../core/repositories/protocol-macro.repository";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";

@Injectable()
export class AddCompatibleMacrosUseCase {
  private readonly logger = new Logger(AddCompatibleMacrosUseCase.name);

  constructor(
    private readonly protocolRepository: ProtocolRepository,
    private readonly protocolMacroRepository: ProtocolMacroRepository,
    private readonly authz: AuthorizationService,
  ) {}

  async execute(
    protocolId: string,
    macroIds: string[],
    currentUserId: string,
  ): Promise<Result<ProtocolMacroDto[]>> {
    this.logger.log({
      msg: "Adding compatible macros to protocol",
      operation: "addCompatibleMacros",
      protocolId,
      userId: currentUserId,
      macroCount: macroIds.length,
    });

    // Check protocol exists
    const protocolResult = await this.protocolRepository.findOne(protocolId);
    if (protocolResult.isFailure()) {
      return failure(AppError.internal("Failed to fetch protocol"));
    }
    if (!protocolResult.value) {
      return failure(AppError.notFound(`Protocol with ID ${protocolId} not found`));
    }

    // Validate that the caller can READ every macro being linked — not just that
    // it exists. Otherwise an editor of a public protocol could link (and thus
    // expose via the compatibility list) a private macro they cannot access.
    // Checks are independent and read-only, so run them in parallel.
    const decisions = await Promise.all(
      macroIds.map((macroId) =>
        this.authz
          .can(currentUserId, { resourceType: "macro", resourceId: macroId, action: "read" })
          .then((decision) => ({ macroId, decision })),
      ),
    );
    const denied = decisions.find((d) => !d.decision.allow);
    if (denied) {
      return failure(
        denied.decision.reason === "not-found"
          ? AppError.notFound(`Macro with ID ${denied.macroId} not found`)
          : AppError.forbidden(`You do not have access to macro ${denied.macroId}`),
      );
    }

    // Add the compatibility links
    const addResult = await this.protocolMacroRepository.addMacros(protocolId, macroIds);
    if (addResult.isFailure()) {
      this.logger.error({
        msg: "Failed to add compatible macros",
        errorCode: ErrorCodes.PROTOCOL_MACROS_ADD_FAILED,
        operation: "addCompatibleMacros",
        protocolId,
      });
      return failure(AppError.internal("Failed to add compatible macros"));
    }

    this.logger.log({
      msg: "Compatible macros added successfully",
      operation: "addCompatibleMacros",
      protocolId,
      userId: currentUserId,
      macroCount: macroIds.length,
      status: "success",
    });
    return success(addResult.value);
  }
}
