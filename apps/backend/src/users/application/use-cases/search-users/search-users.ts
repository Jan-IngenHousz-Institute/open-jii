import { Injectable, Logger } from "@nestjs/common";

import {
  EmailVisibilityService,
  flatEmail,
} from "../../../../authorization/email-visibility.service";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import { AppError, Result } from "../../../../common/utils/fp-utils";
import { UserProfileDto, SearchUsersParams } from "../../../core/models/user.model";
import { UserRepository } from "../../../core/repositories/user.repository";

@Injectable()
export class SearchUsersUseCase {
  private readonly logger = new Logger(SearchUsersUseCase.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly emailVisibility: EmailVisibilityService,
  ) {}

  async execute(callerId: string, params: SearchUsersParams): Promise<Result<UserProfileDto[]>> {
    this.logger.log({
      msg: "Searching users",
      operation: "searchUsers",
      query: params.query,
      limit: params.limit,
      offset: params.offset,
    });

    const result = await this.userRepository.search(params);

    result.fold(
      (users: UserProfileDto[]) => {
        this.logger.debug({
          msg: "Users search completed",
          operation: "searchUsers",
          count: users.length,
          status: "success",
        });
      },
      (error: AppError) => {
        this.logger.error({
          msg: "Failed to search users",
          errorCode: ErrorCodes.USER_NOT_FOUND,
          operation: "searchUsers",
          error,
        });
      },
    );

    return this.emailVisibility.redactAll(callerId, result, flatEmail());
  }
}
