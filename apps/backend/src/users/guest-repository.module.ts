import { Module } from "@nestjs/common";

import { GuestGrantCleanupModule } from "../sharing/guest-grant-cleanup.module";
import { GUEST_IDENTITY_PORT } from "./core/ports/guest-identity.port";
import { GuestRepository } from "./core/repositories/guest.repository";

@Module({
  imports: [GuestGrantCleanupModule],
  providers: [GuestRepository, { provide: GUEST_IDENTITY_PORT, useExisting: GuestRepository }],
  exports: [GUEST_IDENTITY_PORT, GuestRepository],
})
export class GuestRepositoryModule {}
