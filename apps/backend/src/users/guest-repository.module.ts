import { Module } from "@nestjs/common";

import { GUEST_IDENTITY_PORT } from "./core/ports/guest-identity.port";
import { GuestRepository } from "./core/repositories/guest.repository";

@Module({
  providers: [GuestRepository, { provide: GUEST_IDENTITY_PORT, useExisting: GuestRepository }],
  exports: [GUEST_IDENTITY_PORT, GuestRepository],
})
export class GuestRepositoryModule {}
