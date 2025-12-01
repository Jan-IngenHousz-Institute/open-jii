import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { UserProfileDto } from "../../../core/models/user.model";
import { UserRepository } from "../../../core/repositories/user.repository";

@Injectable()
export class GetUserProfileUseCase {
  private readonly logger = new Logger(GetUserProfileUseCase.name);

  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: string): Promise<Result<UserProfileDto>> {
    this.logger.log(`Getting user profile with ID ${id}`);

    const userProfileResult = await this.userRepository.findUserProfile(id);

    return userProfileResult.chain((userProfile: UserProfileDto | null) => {
      if (!userProfile) {
        this.logger.warn(`User profile with ID ${id} not found`);
        return failure(AppError.notFound(`User profile with ID ${id} not found`));
      }

      this.logger.debug(`Found user profile for user ID: ${id}`);
      return success(userProfile);
    });
  }
}
