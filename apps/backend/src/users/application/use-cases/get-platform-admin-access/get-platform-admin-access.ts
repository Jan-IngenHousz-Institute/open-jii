import { Injectable } from "@nestjs/common";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { success } from "../../../../common/utils/fp-utils";

@Injectable()
export class GetPlatformAdminAccessUseCase {
  constructor(private readonly authz: AuthorizationService) {}

  async execute(userId: string, viaApiKey: boolean) {
    const isPlatformAdmin =
      !viaApiKey && (await this.authz.hasPlatformRole(userId, "platform_admin"));
    return success({ isPlatformAdmin });
  }
}
