import { Controller, Logger, UseGuards } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

import { userOrpcContract } from "@repo/api/domains/user/user.orpc";

import { HmacGuard } from "../../common/guards/hmac.guard";
import { throwOrpcFailure } from "../../common/utils/orpc-fp";
import { GetUsersMetadataUseCase } from "../application/use-cases/get-users-metadata/get-users-metadata";

@Controller()
@AllowAnonymous()
@UseGuards(HmacGuard)
export class UserWebhookOrpcController {
  private readonly logger = new Logger(UserWebhookOrpcController.name);

  constructor(private readonly getUsersMetadataUseCase: GetUsersMetadataUseCase) {}

  @Implement(userOrpcContract.getUserMetadata)
  handleGetUserMetadata() {
    return implement(userOrpcContract.getUserMetadata).handler(async ({ input }) => {
      const result = await this.getUsersMetadataUseCase.execute({ userIds: input.userIds });

      if (result.isSuccess()) {
        const users = result.value.map((user) => ({
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          avatarUrl: user.avatarUrl,
        }));

        this.logger.log({
          msg: "Successfully retrieved user metadata",
          operation: "getUsersMetadata",
          usersCount: users.length,
          status: "success",
        });

        return { users, success: true };
      }

      return throwOrpcFailure(result, this.logger);
    });
  }
}
