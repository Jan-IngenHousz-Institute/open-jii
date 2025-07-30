import { Controller, Logger, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";
import type { User } from "@repo/auth/types";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { handleFailure } from "../../common/utils/fp-utils";
import { GetUserUseCase } from "../application/use-cases/get-user/get-user";
import { SearchUsersUseCase } from "../application/use-cases/search-users/search-users";

@Controller()
@UseGuards(AuthGuard)
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(
    private readonly searchUsersUseCase: SearchUsersUseCase,
    private readonly getUserUseCase: GetUserUseCase,
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
}
