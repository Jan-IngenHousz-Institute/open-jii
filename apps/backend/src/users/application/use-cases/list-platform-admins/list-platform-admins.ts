import { Injectable } from "@nestjs/common";

import { PlatformAdminRepository } from "../../../core/repositories/platform-admin.repository";

@Injectable()
export class ListPlatformAdminsUseCase {
  constructor(private readonly repository: PlatformAdminRepository) {}

  execute() {
    return this.repository.list();
  }
}
