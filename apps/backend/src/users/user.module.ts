import { Module } from "@nestjs/common";

// Use Cases
import { CreateUserProfileUseCase } from "./application/use-cases/create-user-profile/create-user-profile";
import { DeleteUserUseCase } from "./application/use-cases/delete-user/delete-user";
import { GetUserProfileUseCase } from "./application/use-cases/get-user-profile/get-user-profile";
import { GetUserUseCase } from "./application/use-cases/get-user/get-user";
import { GetUsersMetadataUseCase } from "./application/use-cases/get-users-metadata/get-users-metadata";
import { SearchUsersUseCase } from "./application/use-cases/search-users/search-users";
// Repositories
import { UserRepository } from "./core/repositories/user.repository";
import { UserWebhookController } from "./presentation/user-webhook.controller";
// Controllers
import { UserController } from "./presentation/user.controller";

@Module({
  controllers: [UserController, UserWebhookController],
  providers: [
    // Repositories
    UserRepository,

    // Use case providers
    DeleteUserUseCase,
    GetUserUseCase,
    SearchUsersUseCase,
    CreateUserProfileUseCase,
    GetUserProfileUseCase,
    GetUsersMetadataUseCase,
  ],
  exports: [UserRepository, GetUsersMetadataUseCase],
})
export class UserModule {}
