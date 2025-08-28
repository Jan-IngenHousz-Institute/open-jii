import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract, validateProtocolJson } from "@repo/api";
import type { User } from "@repo/auth/types";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { AppError, failure, handleFailure, success } from "../../common/utils/fp-utils";
import { CreateProtocolUseCase } from "../application/use-cases/create-protocol/create-protocol";
import { DeleteProtocolUseCase } from "../application/use-cases/delete-protocol/delete-protocol";
import { GetProtocolUseCase } from "../application/use-cases/get-protocol/get-protocol";
import { ListProtocolsUseCase } from "../application/use-cases/list-protocols/list-protocols";
import { UpdateProtocolUseCase } from "../application/use-cases/update-protocol/update-protocol";
import { CreateProtocolDto } from "../core/models/protocol.model";

/**
 * Safely parses the protocol code field, ensuring it's a proper Record<string, unknown>
 * @param code The code field from the protocol, which could be a string, object, or null/undefined
 * @param logger Logger function
 * @returns Parsed code as an object or empty object if input is null/undefined or if parsing fails
 */
function parseProtocolCode(code: unknown, logger: Logger): Record<string, unknown>[] {
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
      logger.error("Error parsing protocol code:", error);
      return [{}];
    }
  }

  return [{}];
}

/**
 * Validates the protocol code fields
 * @param code The code field from the protocol, which could be a string, object, or null/undefined
 * @param logger Logger function
 */
function validateProtocolCode(code: unknown, logger: Logger) {
  const validationResult = validateProtocolJson(code);
  if (!validationResult.success) {
    logger.warn("Protocol validation failed", validationResult.error);
    return failure(AppError.badRequest("Protocol validation failed"));
  }
  return success(validationResult.data);
}

@Controller()
@UseGuards(AuthGuard)
export class ProtocolController {
  private readonly logger = new Logger(ProtocolController.name);

  constructor(
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
  createProtocol(@CurrentUser() user: User) {
    return tsRestHandler(contract.protocols.createProtocol, async ({ body }) => {
      const validationResult = validateProtocolCode(body.code, this.logger);
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

      const result = await this.createProtocolUseCase.execute(createDto, user.id);

      if (result.isSuccess()) {
        const protocol = {
          ...result.value,
          code: parseProtocolCode(result.value.code, this.logger),
        };

        this.logger.log(`Protocol created: ${protocol.id} by user ${user.id}`);
        return {
          status: StatusCodes.CREATED,
          body: formatDates(protocol),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.protocols.updateProtocol)
  updateProtocol(@CurrentUser() user: User) {
    return tsRestHandler(contract.protocols.updateProtocol, async ({ params, body }) => {
      // First check if protocol exists and user is the creator
      const protocolResult = await this.getProtocolUseCase.execute(params.id);

      if (protocolResult.isFailure()) {
        return handleFailure(protocolResult, this.logger);
      }

      if (protocolResult.value.createdBy !== user.id) {
        this.logger.warn(
          `User ${user.id} attempted to update protocol ${params.id} without permission`,
        );
        return {
          status: StatusCodes.FORBIDDEN,
          body: { message: "Only the protocol creator can update this protocol" },
        };
      }

      if (body.code !== undefined) {
        const validationResult = validateProtocolCode(body.code, this.logger);
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

        this.logger.log(`Protocol updated: ${protocol.id} by user ${user.id}`);
        return {
          status: StatusCodes.OK,
          body: formatDates(protocol),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.protocols.deleteProtocol)
  deleteProtocol(@CurrentUser() user: User) {
    return tsRestHandler(contract.protocols.deleteProtocol, async ({ params }) => {
      // First check if protocol exists and user is the creator
      const protocolResult = await this.getProtocolUseCase.execute(params.id);

      if (protocolResult.isFailure()) {
        return handleFailure(protocolResult, this.logger);
      }

      if (protocolResult.value.createdBy !== user.id) {
        this.logger.warn(
          `User ${user.id} attempted to delete protocol ${params.id} without permission`,
        );
        return {
          status: StatusCodes.FORBIDDEN,
          body: { message: "Only the protocol creator can delete this protocol" },
        };
      }

      const result = await this.deleteProtocolUseCase.execute(params.id);

      if (result.isSuccess()) {
        this.logger.log(`Protocol deleted: ${params.id} by user ${user.id}`);
        return {
          status: StatusCodes.NO_CONTENT,
          body: null,
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
