import { Injectable, Logger } from "@nestjs/common";

import { USER_NOT_FOUND } from "../../../../common/utils/error-codes";
import { Result, success, failure, AppError } from "../../../../common/utils/fp-utils";
import { UserDto } from "../../../core/models/user.model";
import { UserRepository } from "../../../core/repositories/user.repository";

@Injectable()
export class GetUserUseCase {
  private readonly logger = new Logger(GetUserUseCase.name);

  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: string): Promise<Result<UserDto>> {
    this.logger.log({
      msg: "Getting user",
      operation: "getUser",
      context: GetUserUseCase.name,
      userId: id,
    });

    const userResult = await this.userRepository.findOne(id);

    return userResult.chain((user: UserDto | null) => {
      if (!user) {
        this.logger.warn({
          msg: "User not found",
          errorCode: USER_NOT_FOUND,
          operation: "getUser",
          context: GetUserUseCase.name,
          userId: id,
        });
        return failure(AppError.notFound(`User with ID ${id} not found`));
      }

      this.logger.debug({
        msg: "User retrieved successfully",
        operation: "getUser",
        context: GetUserUseCase.name,
        userId: id,
        status: "success",
      });
      return success(user);
    });
  }
}
