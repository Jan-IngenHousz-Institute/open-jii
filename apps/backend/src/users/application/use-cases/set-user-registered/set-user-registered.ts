import { Injectable, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { UserDto } from "../../../core/models/user.model";
import { UserRepository } from "../../../core/repositories/user.repository";

@Injectable()
export class SetUserRegisteredUseCase {
  private readonly logger = new Logger(SetUserRegisteredUseCase.name);

  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: string): Promise<Result<UserDto>> {
    this.logger.log(`Set user with ID ${id} as registered`);

    // Check if user exists
    const userResult = await this.userRepository.findOne(id);

    return userResult.chain(async (user: UserDto | null) => {
      if (!user) {
        this.logger.warn(`Attempt to set non-existent user with ID ${id} to registered`);
        return failure(AppError.notFound(`User with ID ${id} not found`));
      }

      this.logger.debug(`Setting user "${user.email}" (ID: ${id}) to registered`);
      // Update the user to set registered status
      const updatedResult = await this.userRepository.updateRegisteredStatus(id);
      return updatedResult.chain((updatedUsers: UserDto[]) => {
        if (updatedUsers.length === 0) {
          this.logger.error(`Failed to set user ${id} as registered`);
          return failure(AppError.internal(`Failed to set user ${id} as registered`));
        }

        const updatedUser = updatedUsers[0];
        this.logger.log(
          `Successfully updated user "${updatedUser.email}" (ID: ${id}) to registered`,
        );
        return success(updatedUser);
      });
    });
  }
}
