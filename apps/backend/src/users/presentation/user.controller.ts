import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { User } from "@repo/auth/types";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
import { CreateUserProfileUseCase } from "../application/use-cases/create-user-profile/create-user-profile";
import { GetUserProfileUseCase } from "../application/use-cases/get-user-profile/get-user-profile";
import { GetUserUseCase } from "../application/use-cases/get-user/get-user";
import { SearchUsersUseCase } from "../application/use-cases/search-users/search-users";

@Controller()
@UseGuards(AuthGuard)
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    private readonly createUserProfileUseCase: CreateUserProfileUseCase,
    private readonly searchUsersUseCase: SearchUsersUseCase,
    private readonly getUserUseCase: GetUserUseCase,
    private readonly getUserProfileUseCase: GetUserProfileUseCase,
  ) {}

  @TsRestHandler(contract.users.searchUsers)
  searchUsers(@CurrentUser() user: User) {
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

        this.logger.log(`Searched users for user ${user.id} with query: ${JSON.stringify(query)}`);
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
  createUserProfile(@CurrentUser() user: User) {
    return tsRestHandler(contract.users.createUserProfile, async ({ body }) => {
      const result = await this.createUserProfileUseCase.execute(body, user.id);
      if (result.isSuccess()) {
        this.logger.log(`Created user profile for ${user.id}`);
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
