import { Injectable, Logger } from "@nestjs/common";

import { ErrorCodes } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { UserProfileDto, UserProfileWithOrcidIdDto } from "../../../core/models/user.model";
import { UserRepository } from "../../../core/repositories/user.repository";

@Injectable()
export class GetUserProfileUseCase {
  private readonly logger = new Logger(GetUserProfileUseCase.name);

  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: string, viewerId: string): Promise<Result<UserProfileWithOrcidIdDto>> {
    this.logger.log({
      msg: "Getting user profile",
      operation: "getUserProfile",
      userId: id,
    });

    const userProfileResult = await this.userRepository.findUserProfile(id);

    return userProfileResult.chain(async (userProfile: UserProfileDto | null) => {
      if (!userProfile) {
        this.logger.warn({
          msg: "User profile not found",
          errorCode: ErrorCodes.USER_PROFILE_NOT_FOUND,
          operation: "getUserProfile",
          userId: id,
        });
        return failure(AppError.notFound(`User profile with ID ${id} not found`));
      }

      // The route answers for any id, so only the owner gets their iD.
      const orcidIdResult =
        viewerId === id ? await this.userRepository.findOrcidId(id) : success(null);

      return orcidIdResult.chain((orcidId: string | null) => {
        this.logger.debug({
          msg: "User profile retrieved successfully",
          operation: "getUserProfile",
          userId: id,
          status: "success",
        });
        return success({ ...userProfile, orcidId });
      });
    });
  }
}
