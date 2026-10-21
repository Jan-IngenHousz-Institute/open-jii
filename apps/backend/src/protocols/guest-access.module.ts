import { Module } from "@nestjs/common";

import { GuestProtocolAccessRepository } from "./core/repositories/guest-access.repository";

@Module({ providers: [GuestProtocolAccessRepository], exports: [GuestProtocolAccessRepository] })
export class GuestProtocolAccessModule {}
