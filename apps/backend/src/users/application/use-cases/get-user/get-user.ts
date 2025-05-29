import { Injectable, Logger } from "@nestjs/common";

import {
  Result,
  success,
  failure,
  AppError,
} from "../../../../common/utils/fp-utils";
import { UserDto } from "../../../core/models/user.model";
import { UserRepository } from "../../../core/repositories/user.repository";

@Injectable()
export class GetUserUseCase {
  private readonly logger = new Logger(GetUserUseCase.name);

  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: string): Promise<Result<UserDto>> {
    this.logger.log(`Getting user with ID ${id}`);

    const userResult = await this.userRepository.findOne(id);

    return userResult.chain((user: UserDto | null) => {
      if (!user) {
        this.logger.warn(`User with ID ${id} not found`);
        return failure(AppError.notFound(`User with ID ${id} not found`));
      }

      this.logger.debug(`Found user "${user.email}" (ID: ${id})`);
      return success(user);
    });
  }
}
