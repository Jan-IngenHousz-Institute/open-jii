import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { UserProfileDto } from "../../../core/models/user.model";
import { UserRepository } from "../../../core/repositories/user.repository";

@Injectable()
export class GetUserProfileUseCase {
  private readonly logger = new Logger(GetUserProfileUseCase.name);

  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: string): Promise<Result<UserProfileDto>> {
    this.logger.log({
      msg: "Getting user profile",
      operation: "getUserProfile",
      context: GetUserProfileUseCase.name,
      userId: id,
    });

    const userProfileResult = await this.userRepository.findUserProfile(id);

    return userProfileResult.chain((userProfile: UserProfileDto | null) => {
      if (!userProfile) {
        this.logger.warn({
          msg: "User profile not found",
          errorCode: ErrorCodes.USER_PROFILE_NOT_FOUND,
          operation: "getUserProfile",
          context: GetUserProfileUseCase.name,
          userId: id,
        });
        return failure(AppError.notFound(`User profile with ID ${id} not found`));
      }

      this.logger.debug({
        msg: "User profile retrieved successfully",
        operation: "getUserProfile",
        context: GetUserProfileUseCase.name,
        userId: id,
        status: "success",
      });
      return success(userProfile);
    });
  }
}
