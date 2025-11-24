import { Module } from "@nestjs/common";

import { DatabricksAdapter } from "../common/modules/databricks/databricks.adapter";
import { DatabricksModule } from "../common/modules/databricks/databricks.module";
import { CreateUserProfileUseCase } from "./application/use-cases/create-user-profile/create-user-profile";
import { DeleteUserUseCase } from "./application/use-cases/delete-user/delete-user";
import { GetUserProfileUseCase } from "./application/use-cases/get-user-profile/get-user-profile";
import { GetUserUseCase } from "./application/use-cases/get-user/get-user";
import { GetUsersMetadataUseCase } from "./application/use-cases/get-users-metadata/get-users-metadata";
import { SearchUsersUseCase } from "./application/use-cases/search-users/search-users";
import { DATABRICKS_PORT } from "./core/ports/databricks.port";
import { UserRepository } from "./core/repositories/user.repository";
import { UserWebhookController } from "./presentation/user-webhook.controller";
// Controllers
import { UserController } from "./presentation/user.controller";

@Module({
  imports: [DatabricksModule],
  controllers: [UserController, UserWebhookController],
  providers: [
    // Repositories
    UserRepository,

    // Ports
    {
      provide: DATABRICKS_PORT,
      useExisting: DatabricksAdapter,
    },

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
