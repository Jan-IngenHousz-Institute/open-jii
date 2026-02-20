import { Controller, Inject, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { FEATURE_FLAGS } from "@repo/analytics";
import { contract, validateProtocolJson } from "@repo/api";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { ErrorCodes } from "../../common/utils/error-codes";
import { AppError, failure, handleFailure, success } from "../../common/utils/fp-utils";
import { CreateProtocolUseCase } from "../application/use-cases/create-protocol/create-protocol";
import { DeleteProtocolUseCase } from "../application/use-cases/delete-protocol/delete-protocol";
import { GetProtocolUseCase } from "../application/use-cases/get-protocol/get-protocol";
import { ListProtocolsUseCase } from "../application/use-cases/list-protocols/list-protocols";
import { UpdateProtocolUseCase } from "../application/use-cases/update-protocol/update-protocol";
import { CreateProtocolDto } from "../core/models/protocol.model";
import { ANALYTICS_PORT } from "../core/ports/analytics.port";
import type { AnalyticsPort } from "../core/ports/analytics.port";

/**
 * Safely parses the protocol code field, ensuring it's a proper Record<string, unknown>
 * @param code The code field from the protocol, which could be a string, object, or null/undefined
 * @param logger Logger function
 * @returns Parsed code as an object or empty object if input is null/undefined or if parsing fails
 */
export function parseProtocolCode(code: unknown, logger: Logger): Record<string, unknown>[] {
  if (!code) {
    return [{}];
  }

  if (typeof code === "object" && Array.isArray(code)) {
    // If code is already an object, ensure it's a Record<string, unknown>
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

/**
 * Validates the protocol code JSON structure
 * @param code The code field from the protocol
 * @param logger Logger function
 * @returns Success if valid JSON structure, failure otherwise
 */
function validateJsonStructure(code: unknown, logger: Logger) {
  // Ensure code is present and is a valid array
  if (!code) {
    return failure(AppError.badRequest("Protocol code is required"));
  }

  if (!Array.isArray(code)) {
    return failure(AppError.badRequest("Protocol code must be an array"));
  }

  try {
    // Verify it can be stringified (valid JSON structure)
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

/**
 * Validates the protocol code fields with full schema validation
 * @param code The code field from the protocol, which could be a string, object, or null/undefined
 * @param logger Logger function
 * @param analyticsPort Analytics port to check feature flags
 * @param useStrictValidation Whether to use strict protocol validation (default: false)
 */
async function validateProtocolCode(
  code: unknown,
  logger: Logger,
  analyticsPort: AnalyticsPort,
  useStrictValidation = false,
) {
  // Check feature flag to determine validation strategy
  const validationAsWarning = await analyticsPort.isFeatureFlagEnabled(
    FEATURE_FLAGS.PROTOCOL_VALIDATION_AS_WARNING,
  );

  // If feature flag is enabled and not using strict validation, only validate JSON structure
  if (validationAsWarning && !useStrictValidation) {
    return validateJsonStructure(code, logger);
  }

  // Otherwise, perform full protocol validation
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
  ) {}

  @TsRestHandler(contract.protocols.listProtocols)
  listProtocols() {
    return tsRestHandler(contract.protocols.listProtocols, async ({ query }) => {
      const result = await this.listProtocolsUseCase.execute(query.search);

      if (result.isSuccess()) {
        // Transform the code field to ensure it's a proper Record<string, unknown>
        const protocols = result.value.map((protocol) => ({
          ...protocol,
          code: parseProtocolCode(protocol.code, this.logger),
        }));

        return {
          status: StatusCodes.OK,
          body: formatDatesList(protocols),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.protocols.getProtocol)
  getProtocol() {
    return tsRestHandler(contract.protocols.getProtocol, async ({ params }) => {
      const result = await this.getProtocolUseCase.execute(params.id);

      if (result.isSuccess()) {
        // Transform the code field to ensure it's a proper Record<string, unknown>
        const protocol = {
          ...result.value,
          code: parseProtocolCode(result.value.code, this.logger),
        };

        return {
          status: StatusCodes.OK,
          body: formatDates(protocol),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.protocols.createProtocol)
  createProtocol(@Session() session: UserSession) {
    return tsRestHandler(contract.protocols.createProtocol, async ({ body }) => {
      const validationResult = await validateProtocolCode(
        body.code,
        this.logger,
        this.analyticsPort,
      );
      if (validationResult.isFailure()) {
        return handleFailure(validationResult, this.logger);
      }

      // Convert the code from Record<string, unknown> to a JSON string for database storage
      const createDto: CreateProtocolDto = {
        name: body.name,
        description: body.description,
        code: JSON.stringify(body.code),
        family: body.family,
      };

      const result = await this.createProtocolUseCase.execute(createDto, session.user.id);

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
        return {
          status: StatusCodes.CREATED,
          body: formatDates(protocol),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.protocols.updateProtocol)
  updateProtocol(@Session() session: UserSession) {
    return tsRestHandler(contract.protocols.updateProtocol, async ({ params, body }) => {
      // First check if protocol exists and user is the creator
      const protocolResult = await this.getProtocolUseCase.execute(params.id);

      if (protocolResult.isFailure()) {
        return handleFailure(protocolResult, this.logger);
      }

      if (protocolResult.value.createdBy !== session.user.id) {
        this.logger.warn({
          msg: "Unauthorized protocol update attempt",
          errorCode: ErrorCodes.FORBIDDEN,
          operation: "updateProtocol",
          protocolId: params.id,
          userId: session.user.id,
          ownerId: protocolResult.value.createdBy,
        });
        return {
          status: StatusCodes.FORBIDDEN,
          body: { message: "Only the protocol creator can update this protocol" },
        };
      }

      if (body.code !== undefined) {
        const validationResult = await validateProtocolCode(
          body.code,
          this.logger,
          this.analyticsPort,
        );
        if (validationResult.isFailure()) {
          return handleFailure(validationResult, this.logger);
        }
      }

      // Convert API contract body to DTO with proper JSON handling
      const updateDto = {
        name: body.name,
        description: body.description,
        code: body.code ? JSON.stringify(body.code) : undefined,
        family: body.family,
      };

      const result = await this.updateProtocolUseCase.execute(params.id, updateDto);

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
        return {
          status: StatusCodes.OK,
          body: formatDates(protocol),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.protocols.deleteProtocol)
  deleteProtocol(@Session() session: UserSession) {
    return tsRestHandler(contract.protocols.deleteProtocol, async ({ params }) => {
      const isDeletionEnabled = await this.analyticsPort.isFeatureFlagEnabled(
        FEATURE_FLAGS.PROTOCOL_DELETION,
        session.user.email || session.user.id,
      );

      if (!isDeletionEnabled) {
        return {
          status: StatusCodes.FORBIDDEN,
          body: { message: "Protocol deletion is currently disabled" },
        };
      }

      // First check if protocol exists and user is the creator
      const protocolResult = await this.getProtocolUseCase.execute(params.id);

      if (protocolResult.isFailure()) {
        return handleFailure(protocolResult, this.logger);
      }

      if (protocolResult.value.createdBy !== session.user.id) {
        this.logger.warn({
          msg: "Unauthorized protocol delete attempt",
          errorCode: ErrorCodes.FORBIDDEN,
          operation: "deleteProtocol",
          protocolId: params.id,
          userId: session.user.id,
          ownerId: protocolResult.value.createdBy,
        });
        return {
          status: StatusCodes.FORBIDDEN,
          body: { message: "Only the protocol creator can delete this protocol" },
        };
      }

      const result = await this.deleteProtocolUseCase.execute(params.id);

      if (result.isSuccess()) {
        this.logger.log({
          msg: "Protocol deleted",
          operation: "deleteProtocol",
          protocolId: params.id,
          userId: session.user.id,
          status: "success",
        });
        return {
          status: StatusCodes.NO_CONTENT,
          body: null,
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
