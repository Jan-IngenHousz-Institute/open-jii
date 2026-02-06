import { Controller, Logger, UseGuards } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { HmacGuard } from "../../common/guards/hmac.guard";
import { handleFailure } from "../../common/utils/fp-utils";
import { GetUsersMetadataUseCase } from "../application/use-cases/get-users-metadata/get-users-metadata";

@Controller()
@AllowAnonymous()
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
          avatarUrl: user.image,
        }));

        this.logger.log({
          msg: "Successfully retrieved user metadata",
          operation: "getUsersMetadata",
          usersCount: users.length,
          status: "success",
        });

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
