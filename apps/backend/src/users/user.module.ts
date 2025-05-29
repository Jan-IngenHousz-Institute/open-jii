import { Module } from "@nestjs/common";

// Use Cases
import { GetUserUseCase } from "./application/use-cases/get-user/get-user";
import { SearchUsersUseCase } from "./application/use-cases/search-users/search-users";
// Repositories
import { UserRepository } from "./core/repositories/user.repository";
// Controllers
import { UserController } from "./presentation/user.controller";

@Module({
  controllers: [UserController],
  providers: [
    // Repositories
    UserRepository,

    // Use case providers
    GetUserUseCase,
    SearchUsersUseCase,
  ],
  exports: [UserRepository],
})
export class UserModule {}
