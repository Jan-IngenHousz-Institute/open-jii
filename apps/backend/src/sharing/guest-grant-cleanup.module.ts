import { Module } from "@nestjs/common";

import { GUEST_GRANT_CLEANUP_PORT } from "./core/ports/guest-grant-cleanup.port";
import { GuestGrantCleanupRepository } from "./core/repositories/guest-grant-cleanup.repository";

@Module({
  providers: [
    GuestGrantCleanupRepository,
    { provide: GUEST_GRANT_CLEANUP_PORT, useExisting: GuestGrantCleanupRepository },
  ],
  exports: [GUEST_GRANT_CLEANUP_PORT],
})
export class GuestGrantCleanupModule {}
