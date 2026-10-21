import { Module } from "@nestjs/common";

import { GuestExperimentAccessRepository } from "./core/repositories/guest-access.repository";

@Module({
  providers: [GuestExperimentAccessRepository],
  exports: [GuestExperimentAccessRepository],
})
export class GuestExperimentAccessModule {}
