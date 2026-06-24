import { Controller, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { userOrpcContract } from "@repo/api/domains/user/user.orpc";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { AppError } from "../../common/utils/fp-utils";
import { throwOrpcError, throwOrpcFailure } from "../../common/utils/orpc-fp";
import { CreateUserProfileUseCase } from "../application/use-cases/create-user-profile/create-user-profile";
import { DeleteUserUseCase } from "../application/use-cases/delete-user/delete-user";
import { GetDeletionBlockersUseCase } from "../application/use-cases/get-deletion-blockers/get-deletion-blockers";
import { GetUserProfileUseCase } from "../application/use-cases/get-user-profile/get-user-profile";
import { GetUserUseCase } from "../application/use-cases/get-user/get-user";
import { SearchUsersUseCase } from "../application/use-cases/search-users/search-users";

@Controller()
export class UserOrpcController {
  private readonly logger = new Logger(UserOrpcController.name);

  constructor(
    private readonly createUserProfileUseCase: CreateUserProfileUseCase,
    private readonly searchUsersUseCase: SearchUsersUseCase,
    private readonly getUserUseCase: GetUserUseCase,
    private readonly getUserProfileUseCase: GetUserProfileUseCase,
    private readonly deleteUserUseCase: DeleteUserUseCase,
    private readonly getDeletionBlockersUseCase: GetDeletionBlockersUseCase,
  ) {}

  @Implement(userOrpcContract.deleteUser)
  deleteUser() {
    return implement(userOrpcContract.deleteUser).handler(async ({ input }) => {
      const result = await this.deleteUserUseCase.execute(input.id);
      if (result.isSuccess()) {
        this.logger.log({
          msg: "User deleted",
          operation: "deleteUser",
          userId: input.id,
          status: "success",
        });
        return undefined;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(userOrpcContract.getDeletionBlockers)
  getDeletionBlockers(@Session() session: UserSession) {
    return implement(userOrpcContract.getDeletionBlockers).handler(async ({ input }) => {
      if (input.id !== session.user.id) {
        return throwOrpcError(
          AppError.forbidden("You can only view your own deletion blockers"),
          this.logger,
          "getDeletionBlockers",
        );
      }

      const result = await this.getDeletionBlockersUseCase.execute(input.id);
      if (result.isSuccess()) {
        return { experiments: result.value };
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(userOrpcContract.searchUsers)
  searchUsers() {
    return implement(userOrpcContract.searchUsers).handler(async ({ input }) => {
      const result = await this.searchUsersUseCase.execute({
        query: input.query,
        limit: input.limit,
        offset: input.offset,
      });
      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(userOrpcContract.getUser)
  getUser() {
    return implement(userOrpcContract.getUser).handler(async ({ input }) => {
      const result = await this.getUserUseCase.execute(input.id);
      if (result.isSuccess()) {
        return formatDates(result.value);
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(userOrpcContract.createUserProfile)
  createUserProfile(@Session() session: UserSession) {
    return implement(userOrpcContract.createUserProfile).handler(async ({ input }) => {
      const result = await this.createUserProfileUseCase.execute(input, session.user.id);
      if (result.isSuccess()) {
        this.logger.log({
          msg: "User profile created",
          operation: "createUserProfile",
          userId: session.user.id,
          status: "success",
        });
        return {};
      }
      return throwOrpcFailure(result, this.logger);
    });
  }

  @Implement(userOrpcContract.getUserProfile)
  getUserProfile() {
    return implement(userOrpcContract.getUserProfile).handler(async ({ input }) => {
      const result = await this.getUserProfileUseCase.execute(input.id);
      if (result.isSuccess()) {
        return result.value;
      }
      return throwOrpcFailure(result, this.logger);
    });
  }
}
