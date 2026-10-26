import { Injectable, Logger } from "@nestjs/common";

import {
  EmailVisibilityService,
  userRecordEmail,
} from "../../../../authorization/email-visibility.service";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { UserDto } from "../../../core/models/user.model";
import { UserRepository } from "../../../core/repositories/user.repository";

@Injectable()
export class GetUserUseCase {
  private readonly logger = new Logger(GetUserUseCase.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly emailVisibility: EmailVisibilityService,
  ) {}

  /**
   * Anyone but the user themself resolves only a live, activated account, so a
   * deactivated or deleted one answers exactly like an id that never existed.
   */
  async execute(callerId: string, id: string): Promise<Result<UserDto>> {
    this.logger.log({
      msg: "Getting user",
      operation: "getUser",
      userId: id,
    });

    const userResult =
      id === callerId
        ? await this.userRepository.findOne(id)
        : await this.userRepository.findDiscoverable(id);

    if (userResult.isFailure()) {
      return userResult;
    }
    const user = userResult.value;
    if (!user) {
      this.logger.warn({
        msg: "User not found",
        errorCode: ErrorCodes.USER_NOT_FOUND,
        operation: "getUser",
        userId: id,
      });
      return failure(AppError.notFound(`User with ID ${id} not found`));
    }

    this.logger.debug({
      msg: "User retrieved successfully",
      operation: "getUser",
      userId: id,
      status: "success",
    });
    return this.emailVisibility.redactOne(callerId, success(user), userRecordEmail());
  }
}
