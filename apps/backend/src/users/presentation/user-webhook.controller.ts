import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { HmacGuard } from "../../common/guards/hmac.guard";
import { handleFailure } from "../../common/utils/fp-utils";
import { GetUsersMetadataUseCase } from "../application/use-cases/get-users-metadata/get-users-metadata";

@Controller()
@UseGuards(HmacGuard)
export class UserWebhookController {
  private readonly logger = new Logger(UserWebhookController.name);

  constructor(private readonly getUsersMetadataUseCase: GetUsersMetadataUseCase) {}

  @TsRestHandler(contract.users.getUserMetadata)
  handleGetUserMetadata() {
    return tsRestHandler(contract.users.getUserMetadata, async ({ body }) => {
      const result = await this.getUsersMetadataUseCase.execute({
        userIds: body.userIds,
      });

      if (result.isSuccess()) {
        const users = result.value.map((user) => ({
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
        }));

        this.logger.log(`Successfully retrieved metadata for ${users.length} users`);

        return {
          status: StatusCodes.OK as const,
          body: {
            users,
            success: true,
          },
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
