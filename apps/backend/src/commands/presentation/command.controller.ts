import { Controller, Inject, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { FEATURE_FLAGS } from "@repo/analytics";
import { contract } from "@repo/api/contract";
import { validateCommandJson } from "@repo/api/schemas/command-validator";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { ErrorCodes } from "../../common/utils/error-codes";
import { AppError, failure, handleFailure, success } from "../../common/utils/fp-utils";
import { AddCompatibleMacrosUseCase } from "../application/use-cases/add-compatible-macros/add-compatible-macros";
import { CreateCommandUseCase } from "../application/use-cases/create-command/create-command";
import { DeleteCommandUseCase } from "../application/use-cases/delete-command/delete-command";
import { GetCommandUseCase } from "../application/use-cases/get-command/get-command";
import { ListCompatibleMacrosUseCase } from "../application/use-cases/list-compatible-macros/list-compatible-macros";
import { ListCommandsUseCase } from "../application/use-cases/list-commands/list-commands";
import { RemoveCompatibleMacroUseCase } from "../application/use-cases/remove-compatible-macro/remove-compatible-macro";
import { UpdateCommandUseCase } from "../application/use-cases/update-command/update-command";
import { CreateCommandDto } from "../core/models/command.model";
import { ANALYTICS_PORT } from "../core/ports/analytics.port";
import type { AnalyticsPort } from "../core/ports/analytics.port";

/**
 * Safely parses the command code field, ensuring it's a proper Record<string, unknown>
 * @param code The code field from the command, which could be a string, object, or null/undefined
 * @param logger Logger function
 * @returns Parsed code as an object or empty object if input is null/undefined or if parsing fails
 */
export function parseCommandCode(code: unknown, logger: Logger): Record<string, unknown>[] {
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
        msg: "Failed to parse command code",
        errorCode: ErrorCodes.BAD_REQUEST,
        operation: "parseCommandCode",
        error,
      });
      return [{}];
    }
  }

  return [{}];
}

/**
 * Validates the command code JSON structure
 * @param code The code field from the command
 * @param logger Logger function
 * @returns Success if valid JSON structure, failure otherwise
 */
function validateJsonStructure(code: unknown, logger: Logger) {
  // Ensure code is present and is a valid array
  if (!code) {
    return failure(AppError.badRequest("Command code is required"));
  }

  if (!Array.isArray(code)) {
    return failure(AppError.badRequest("Command code must be an array"));
  }

  try {
    // Verify it can be stringified (valid JSON structure)
    JSON.stringify(code);
    return success(code);
  } catch (error) {
    logger.warn({
      msg: "Command JSON structure validation failed",
      errorCode: ErrorCodes.BAD_REQUEST,
      operation: "validateJsonStructure",
      error,
    });
    return failure(AppError.badRequest("Invalid JSON structure"));
  }
}

/**
 * Validates the command code fields with full schema validation
 * @param code The code field from the command, which could be a string, object, or null/undefined
 * @param logger Logger function
 * @param analyticsPort Analytics port to check feature flags
 * @param useStrictValidation Whether to use strict command validation (default: false)
 */
async function validateCommandCode(
  code: unknown,
  logger: Logger,
  analyticsPort: AnalyticsPort,
  useStrictValidation = false,
) {
  // Check feature flag to determine validation strategy
  const validationAsWarning = await analyticsPort.isFeatureFlagEnabled(
    FEATURE_FLAGS.COMMAND_VALIDATION_AS_WARNING,
  );

  // If feature flag is enabled and not using strict validation, only validate JSON structure
  if (validationAsWarning && !useStrictValidation) {
    return validateJsonStructure(code, logger);
  }

  // Otherwise, perform full command validation
  const validationResult = validateCommandJson(code);
  if (!validationResult.success) {
    logger.warn({
      msg: "Command validation failed",
      errorCode: ErrorCodes.UNPROCESSABLE_ENTITY,
      operation: "validateCommandCode",
      validationError: validationResult.error,
    });
    return failure(AppError.badRequest("Command validation failed"));
  }
  return success(validationResult.data);
}

@Controller()
export class CommandController {
  private readonly logger = new Logger(CommandController.name);

  constructor(
    @Inject(ANALYTICS_PORT)
    private readonly analyticsPort: AnalyticsPort,
    private readonly createCommandUseCase: CreateCommandUseCase,
    private readonly getCommandUseCase: GetCommandUseCase,
    private readonly listCommandsUseCase: ListCommandsUseCase,
    private readonly updateCommandUseCase: UpdateCommandUseCase,
    private readonly deleteCommandUseCase: DeleteCommandUseCase,
    private readonly listCompatibleMacrosUseCase: ListCompatibleMacrosUseCase,
    private readonly addCompatibleMacrosUseCase: AddCompatibleMacrosUseCase,
    private readonly removeCompatibleMacroUseCase: RemoveCompatibleMacroUseCase,
  ) {}

  @TsRestHandler(contract.commands.listCommands)
  listCommands(@Session() session: UserSession) {
    return tsRestHandler(contract.commands.listCommands, async ({ query }) => {
      const result = await this.listCommandsUseCase.execute(
        query.search,
        query.filter,
        session.user.id,
      );

      if (result.isSuccess()) {
        // Transform the code field to ensure it's a proper Record<string, unknown>
        const commands = result.value.map((command) => ({
          ...command,
          code: parseCommandCode(command.code, this.logger),
        }));

        return {
          status: StatusCodes.OK,
          body: formatDatesList(commands),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.commands.getCommand)
  getCommand() {
    return tsRestHandler(contract.commands.getCommand, async ({ params }) => {
      const result = await this.getCommandUseCase.execute(params.id);

      if (result.isSuccess()) {
        // Transform the code field to ensure it's a proper Record<string, unknown>
        const command = {
          ...result.value,
          code: parseCommandCode(result.value.code, this.logger),
        };

        return {
          status: StatusCodes.OK,
          body: formatDates(command),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.commands.createCommand)
  createCommand(@Session() session: UserSession) {
    return tsRestHandler(contract.commands.createCommand, async ({ body }) => {
      const validationResult = await validateCommandCode(
        body.code,
        this.logger,
        this.analyticsPort,
      );
      if (validationResult.isFailure()) {
        return handleFailure(validationResult, this.logger);
      }

      // Convert the code from Record<string, unknown> to a JSON string for database storage
      const createDto: CreateCommandDto = {
        name: body.name,
        description: body.description,
        code: JSON.stringify(body.code),
        family: body.family,
        forkedFrom: body.forkedFrom,
      };

      const result = await this.createCommandUseCase.execute(createDto, session.user.id);

      if (result.isSuccess()) {
        const command = {
          ...result.value,
          code: parseCommandCode(result.value.code, this.logger),
        };

        this.logger.log({
          msg: "Command created",
          operation: "createCommand",
          commandId: command.id,
          userId: session.user.id,
          status: "success",
        });
        return {
          status: StatusCodes.CREATED,
          body: formatDates(command),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.commands.updateCommand)
  updateCommand(@Session() session: UserSession) {
    return tsRestHandler(contract.commands.updateCommand, async ({ params, body }) => {
      // First check if command exists and user is the creator
      const commandResult = await this.getCommandUseCase.execute(params.id);

      if (commandResult.isFailure()) {
        return handleFailure(commandResult, this.logger);
      }

      if (commandResult.value.createdBy !== session.user.id) {
        this.logger.warn({
          msg: "Unauthorized command update attempt",
          errorCode: ErrorCodes.FORBIDDEN,
          operation: "updateCommand",
          commandId: params.id,
          userId: session.user.id,
          ownerId: commandResult.value.createdBy,
        });
        return {
          status: StatusCodes.FORBIDDEN,
          body: { message: "Only the command creator can update this command" },
        };
      }

      if (body.code !== undefined) {
        const validationResult = await validateCommandCode(
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

      const result = await this.updateCommandUseCase.execute(params.id, updateDto);

      if (result.isSuccess()) {
        const command = {
          ...result.value,
          code: parseCommandCode(result.value.code, this.logger),
        };

        this.logger.log({
          msg: "Command updated",
          operation: "updateCommand",
          commandId: command.id,
          userId: session.user.id,
          status: "success",
        });
        return {
          status: StatusCodes.OK,
          body: formatDates(command),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.commands.deleteCommand)
  deleteCommand(@Session() session: UserSession) {
    return tsRestHandler(contract.commands.deleteCommand, async ({ params }) => {
      const isDeletionEnabled = await this.analyticsPort.isFeatureFlagEnabled(
        FEATURE_FLAGS.COMMAND_DELETION,
        session.user.email || session.user.id,
      );

      if (!isDeletionEnabled) {
        return {
          status: StatusCodes.FORBIDDEN,
          body: { message: "Command deletion is currently disabled" },
        };
      }

      // First check if command exists and user is the creator
      const commandResult = await this.getCommandUseCase.execute(params.id);

      if (commandResult.isFailure()) {
        return handleFailure(commandResult, this.logger);
      }

      if (commandResult.value.createdBy !== session.user.id) {
        this.logger.warn({
          msg: "Unauthorized command delete attempt",
          errorCode: ErrorCodes.FORBIDDEN,
          operation: "deleteCommand",
          commandId: params.id,
          userId: session.user.id,
          ownerId: commandResult.value.createdBy,
        });
        return {
          status: StatusCodes.FORBIDDEN,
          body: { message: "Only the command creator can delete this command" },
        };
      }

      const result = await this.deleteCommandUseCase.execute(params.id);

      if (result.isSuccess()) {
        this.logger.log({
          msg: "Command deleted",
          operation: "deleteCommand",
          commandId: params.id,
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

  @TsRestHandler(contract.commands.listCompatibleMacros)
  listCompatibleMacros() {
    return tsRestHandler(contract.commands.listCompatibleMacros, async ({ params }) => {
      const result = await this.listCompatibleMacrosUseCase.execute(params.id);

      if (result.isSuccess()) {
        return {
          status: StatusCodes.OK,
          body: formatDatesList(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.commands.addCompatibleMacros)
  addCompatibleMacros(@Session() session: UserSession) {
    return tsRestHandler(contract.commands.addCompatibleMacros, async ({ params, body }) => {
      const result = await this.addCompatibleMacrosUseCase.execute(
        params.id,
        body.macroIds,
        session.user.id,
      );

      if (result.isSuccess()) {
        return {
          status: StatusCodes.CREATED,
          body: formatDatesList(result.value),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.commands.removeCompatibleMacro)
  removeCompatibleMacro(@Session() session: UserSession) {
    return tsRestHandler(contract.commands.removeCompatibleMacro, async ({ params }) => {
      const result = await this.removeCompatibleMacroUseCase.execute(
        params.id,
        params.macroId,
        session.user.id,
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
