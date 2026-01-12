import { Controller, Logger } from "@nestjs/common";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
import { CreateUserProfileUseCase } from "../application/use-cases/create-user-profile/create-user-profile";
import { DeleteUserUseCase } from "../application/use-cases/delete-user/delete-user";
import { GetUserProfileUseCase } from "../application/use-cases/get-user-profile/get-user-profile";
import { GetUserUseCase } from "../application/use-cases/get-user/get-user";
import { SearchUsersUseCase } from "../application/use-cases/search-users/search-users";

@Controller()
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    private readonly createUserProfileUseCase: CreateUserProfileUseCase,
    private readonly searchUsersUseCase: SearchUsersUseCase,
    private readonly getUserUseCase: GetUserUseCase,
    private readonly getUserProfileUseCase: GetUserProfileUseCase,
    private readonly deleteUserUseCase: DeleteUserUseCase,
  ) {}

  @TsRestHandler(contract.users.deleteUser)
  deleteUser() {
    return tsRestHandler(contract.users.deleteUser, async ({ params }) => {
      const result = await this.deleteUserUseCase.execute(params.id);

      if (result.isSuccess()) {
        this.logger.log(`Deleted user ${params.id}`);
        return {
          status: StatusCodes.NO_CONTENT,
          body: null,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.users.searchUsers)
  searchUsers(@Session() session: UserSession) {
    return tsRestHandler(contract.users.searchUsers, async ({ query }) => {
      const result = await this.searchUsersUseCase.execute({
        query: query.query,
        limit: query.limit,
        offset: query.offset,
      });

      if (result.isSuccess()) {
        const users = result.value;

        // Format dates to strings for the API contract
        const formattedUsers = formatDatesList(users);

        this.logger.log(
          `Searched users for user ${session.user.id} with query: ${JSON.stringify(query)}`,
        );
        return {
          status: StatusCodes.OK,
          body: formattedUsers,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.users.getUser)
  getUser() {
    return tsRestHandler(contract.users.getUser, async ({ params }) => {
      const result = await this.getUserUseCase.execute(params.id);

      if (result.isSuccess()) {
        const user = result.value;

        // Format dates to strings for the API contract
        const formattedUser = formatDates(user);

        this.logger.log(`User ${params.id} retrieved`);
        return {
          status: StatusCodes.OK,
          body: formattedUser,
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.users.createUserProfile)
  createUserProfile(@Session() session: UserSession) {
    return tsRestHandler(contract.users.createUserProfile, async ({ body }) => {
      const result = await this.createUserProfileUseCase.execute(body, session.user.id);
      if (result.isSuccess()) {
        this.logger.log(`Created user profile for ${session.user.id}`);
        return {
          status: StatusCodes.CREATED,
          body: {},
        };
      }

      return handleFailure(result, this.logger);
    });
  }

  @TsRestHandler(contract.users.getUserProfile)
  getUserProfile() {
    return tsRestHandler(contract.users.getUserProfile, async ({ params }) => {
      const result = await this.getUserProfileUseCase.execute(params.id);

      if (result.isSuccess()) {
        const userProfile = result.value;
        this.logger.log(`User profile ${params.id} retrieved`);
        return {
          status: StatusCodes.OK,
          body: userProfile,
        };
      }

      return handleFailure(result, this.logger);
    });
  }
}
