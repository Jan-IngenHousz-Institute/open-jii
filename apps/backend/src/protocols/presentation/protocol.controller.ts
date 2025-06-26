import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { SessionUser } from "@repo/auth/config";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
import { CreateProtocolUseCase } from "../application/use-cases/create-protocol/create-protocol";
import { DeleteProtocolUseCase } from "../application/use-cases/delete-protocol/delete-protocol";
import { GetProtocolUseCase } from "../application/use-cases/get-protocol/get-protocol";
import { ListProtocolsUseCase } from "../application/use-cases/list-protocols/list-protocols";
import { UpdateProtocolUseCase } from "../application/use-cases/update-protocol/update-protocol";
import { CreateProtocolDto } from "../core/models/protocol.model";

/**
 * Safely parses the protocol code field, ensuring it's a proper Record<string, unknown>
 * @param code The code field from the protocol, which could be a string, object, or null/undefined
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
  createProtocol(@CurrentUser() user: SessionUser) {
    return tsRestHandler(contract.protocols.createProtocol, async ({ body }) => {
      // Convert the code from Record<string, unknown> to a JSON string for database storage
      const createDto: CreateProtocolDto = {
        name: body.name,
        description: body.description,
        code: JSON.stringify(body.code),
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
  updateProtocol() {
    return tsRestHandler(contract.protocols.updateProtocol, async ({ params, body }) => {
      // Convert API contract body to DTO with proper JSON handling
      const updateDto = {
        name: body.name,
        description: body.description,
        code: body.code ? JSON.stringify(body.code) : undefined,
      };

      const result = await this.updateProtocolUseCase.execute(params.id, updateDto);

      if (result.isSuccess()) {
        const protocol = {
          ...result.value,
          code: parseProtocolCode(result.value.code, this.logger),
        };

        this.logger.log(`Protocol updated: ${protocol.id}`);
        return {
          status: StatusCodes.OK,
          body: formatDates(protocol),
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.protocols.deleteProtocol)
  deleteProtocol() {
    return tsRestHandler(contract.protocols.deleteProtocol, async ({ params }) => {
      const result = await this.deleteProtocolUseCase.execute(params.id);

      if (result.isSuccess()) {
        this.logger.log(`Protocol deleted: ${params.id}`);
        return {
          status: StatusCodes.NO_CONTENT,
          body: null,
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
