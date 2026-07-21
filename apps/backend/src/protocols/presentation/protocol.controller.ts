import { Controller, Inject, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { FEATURE_FLAGS } from "@repo/analytics";
import { validateProtocolJson } from "@repo/api/domains/protocol/protocol-validator";
import { protocolContract } from "@repo/api/domains/protocol/protocol.contract";

import { CanAccess } from "../../authorization/can-access.decorator";
import { CanCreateInOrg } from "../../authorization/can-create-in-org.guard";
import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { ErrorCodes } from "../../common/utils/error-codes";
import { AppError, failure, success } from "../../common/utils/fp-utils";
import { throwOrpcError, throwOrpcFailure } from "../../common/utils/orpc-fp";
import { AddCompatibleMacrosUseCase } from "../application/use-cases/add-compatible-macros/add-compatible-macros";
import { CreateProtocolUseCase } from "../application/use-cases/create-protocol/create-protocol";
import { DeleteProtocolUseCase } from "../application/use-cases/delete-protocol/delete-protocol";
import { GetProtocolUseCase } from "../application/use-cases/get-protocol/get-protocol";
import { ListCompatibleMacrosUseCase } from "../application/use-cases/list-compatible-macros/list-compatible-macros";
import { ListProtocolsUseCase } from "../application/use-cases/list-protocols/list-protocols";
import { RemoveCompatibleMacroUseCase } from "../application/use-cases/remove-compatible-macro/remove-compatible-macro";
import { UpdateProtocolUseCase } from "../application/use-cases/update-protocol/update-protocol";
import { CreateProtocolDto } from "../core/models/protocol.model";
import { ANALYTICS_PORT } from "../core/ports/analytics.port";
import type { AnalyticsPort } from "../core/ports/analytics.port";

export function parseProtocolCode(code: unknown, logger: Logger): Record<string, unknown>[] {
  if (!code) {
    return [{}];
  }

  if (typeof code === "object" && Array.isArray(code)) {
    return code as Record<string, unknown>[];
  }

  if (typeof code === "string") {
    try {
      return JSON.parse(code) as Record<string, unknown>[];
    } catch (error) {
      logger.error({
        msg: "Failed to parse protocol code",
        errorCode: ErrorCodes.BAD_REQUEST,
        operation: "parseProtocolCode",
        error,
      });
      return [{}];
    }
  }

  return [{}];
}

function validateJsonStructure(code: unknown, logger: Logger) {
  if (!code) {
    return failure(AppError.badRequest("Protocol code is required"));
  }

  if (!Array.isArray(code)) {
    return failure(AppError.badRequest("Protocol code must be an array"));
  }

  try {
    JSON.stringify(code);
    return success(code);
  } catch (error) {
    logger.warn({
      msg: "Protocol JSON structure validation failed",
      errorCode: ErrorCodes.BAD_REQUEST,
      operation: "validateJsonStructure",
      error,
    });
    return failure(AppError.badRequest("Invalid JSON structure"));
  }
}

async function validateProtocolCode(
  code: unknown,
  logger: Logger,
  analyticsPort: AnalyticsPort,
  useStrictValidation = false,
) {
  const validationAsWarning = await analyticsPort.isFeatureFlagEnabled(
    FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
  );

  if (validationAsWarning && !useStrictValidation) {
    return validateJsonStructure(code, logger);
  }

  const validationResult = validateProtocolJson(code);
  if (!validationResult.success) {
    logger.warn({
      msg: "Protocol validation failed",
      errorCode: ErrorCodes.UNPROCESSABLE_ENTITY,
      operation: "validateProtocolCode",
      validationError: validationResult.error,
    });
    return failure(AppError.badRequest("Protocol validation failed"));
  }
  return success(validationResult.data);
}

@Controller()
export class ProtocolController {
  private readonly logger = new Logger(ProtocolController.name);

  constructor(
    @Inject(ANALYTICS_PORT)
    private readonly analyticsPort: AnalyticsPort,
    private readonly createProtocolUseCase: CreateProtocolUseCase,
    private readonly getProtocolUseCase: GetProtocolUseCase,
    private readonly listProtocolsUseCase: ListProtocolsUseCase,
    private readonly updateProtocolUseCase: UpdateProtocolUseCase,
    private readonly deleteProtocolUseCase: DeleteProtocolUseCase,
    private readonly listCompatibleMacrosUseCase: ListCompatibleMacrosUseCase,
    private readonly addCompatibleMacrosUseCase: AddCompatibleMacrosUseCase,
    private readonly removeCompatibleMacroUseCase: RemoveCompatibleMacroUseCase,
  ) {}

  @Implement(protocolContract.listProtocols)
  listProtocols(@Session() session: UserSession) {
    return implement(protocolContract.listProtocols).handler(async ({ input }) => {
      const result = await this.listProtocolsUseCase.execute(
        input.search,
        input.filter,
        session.user.id,
      );

      if (result.isSuccess()) {
        const protocols = result.value.map((protocol) => ({
          ...protocol,
          code: parseProtocolCode(protocol.code, this.logger),
        }));

        return formatDatesList(protocols);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "protocol", action: "read" })
  @Implement(protocolContract.getProtocol)
  getProtocol() {
    return implement(protocolContract.getProtocol).handler(async ({ input }) => {
      const result = await this.getProtocolUseCase.execute(input.id);

      if (result.isSuccess()) {
        const protocol = {
          ...result.value,
          code: parseProtocolCode(result.value.code, this.logger),
        };

        return formatDates(protocol);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanCreateInOrg()
  @Implement(protocolContract.createProtocol)
  createProtocol(@Session() session: UserSession) {
    return implement(protocolContract.createProtocol).handler(async ({ input }) => {
      const validationResult = await validateProtocolCode(
        input.code,
        this.logger,
        this.analyticsPort,
      );
      if (validationResult.isFailure()) {
        return throwOrpcFailure(validationResult, this.logger);
      }

      const createDto: CreateProtocolDto = {
        name: input.name,
        description: input.description,
        code: JSON.stringify(input.code),
        family: input.family,
        forkedFrom: input.forkedFrom,
      };

      const result = await this.createProtocolUseCase.execute(
        createDto,
        session.user.id,
        input.organizationId ?? null,
      );

      if (result.isSuccess()) {
        const protocol = {
          ...result.value,
          code: parseProtocolCode(result.value.code, this.logger),
        };

        this.logger.log({
          msg: "Protocol created",
          operation: "createProtocol",
          protocolId: protocol.id,
          userId: session.user.id,
          status: "success",
        });
        return formatDates(protocol);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "protocol", action: "update" })
  @Implement(protocolContract.updateProtocol)
  updateProtocol(@Session() session: UserSession) {
    return implement(protocolContract.updateProtocol).handler(async ({ input }) => {
      const { id, ...body } = input;

      if (body.code !== undefined) {
        const validationResult = await validateProtocolCode(
          body.code,
          this.logger,
          this.analyticsPort,
        );
        if (validationResult.isFailure()) {
          return throwOrpcFailure(validationResult, this.logger);
        }
      }

      const updateDto = {
        name: body.name,
        description: body.description,
        code: body.code ? JSON.stringify(body.code) : undefined,
        family: body.family,
      };

      const result = await this.updateProtocolUseCase.execute(id, updateDto, session.user.id);

      if (result.isSuccess()) {
        const protocol = {
          ...result.value,
          code: parseProtocolCode(result.value.code, this.logger),
        };

        this.logger.log({
          msg: "Protocol updated",
          operation: "updateProtocol",
          protocolId: protocol.id,
          userId: session.user.id,
          status: "success",
        });
        return formatDates(protocol);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "protocol", action: "manage" })
  @Implement(protocolContract.deleteProtocol)
  deleteProtocol(@Session() session: UserSession) {
    return implement(protocolContract.deleteProtocol).handler(async ({ input }) => {
      const isDeletionEnabled = await this.analyticsPort.isFeatureFlagEnabled(
        FEATURE_FLAGS.PROTOCOL_DELETION,
        session.user.email || session.user.id,
      );

      if (!isDeletionEnabled) {
        return throwOrpcError(
          AppError.forbidden("Protocol deletion is currently disabled"),
          this.logger,
          "deleteProtocol",
        );
      }

      const result = await this.deleteProtocolUseCase.execute(input.id, session.user.id);

      if (result.isSuccess()) {
        this.logger.log({
          msg: "Protocol deleted",
          operation: "deleteProtocol",
          protocolId: input.id,
          userId: session.user.id,
          status: "success",
        });
        return undefined;
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "protocol", action: "read" })
  @Implement(protocolContract.listCompatibleMacros)
  listCompatibleMacros() {
    return implement(protocolContract.listCompatibleMacros).handler(async ({ input }) => {
      const result = await this.listCompatibleMacrosUseCase.execute(input.id);

      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "protocol", action: "update" })
  @Implement(protocolContract.addCompatibleMacros)
  addCompatibleMacros(@Session() session: UserSession) {
    return implement(protocolContract.addCompatibleMacros).handler(async ({ input }) => {
      const result = await this.addCompatibleMacrosUseCase.execute(
        input.id,
        input.macroIds,
        session.user.id,
      );

      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }

      return throwOrpcFailure(result, this.logger);
    });
  }

  @CanAccess({ resource: "protocol", action: "update" })
  @Implement(protocolContract.removeCompatibleMacro)
  removeCompatibleMacro(@Session() session: UserSession) {
    return implement(protocolContract.removeCompatibleMacro).handler(async ({ input }) => {
      const result = await this.removeCompatibleMacroUseCase.execute(
        input.id,
        input.macroId,
        session.user.id,
      );

      if (result.isSuccess()) {
        return undefined;
      }

      return throwOrpcFailure(result, this.logger);
    });
  }
}
