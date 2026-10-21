import { Module } from "@nestjs/common";

import { GuestWorkbookAccessRepository } from "./core/repositories/guest-access.repository";

@Module({ providers: [GuestWorkbookAccessRepository], exports: [GuestWorkbookAccessRepository] })
export class GuestWorkbookAccessModule {}
