import { Module } from "@nestjs/common";

import { GuestMacroAccessRepository } from "./core/repositories/guest-access.repository";

@Module({ providers: [GuestMacroAccessRepository], exports: [GuestMacroAccessRepository] })
export class GuestMacroAccessModule {}
