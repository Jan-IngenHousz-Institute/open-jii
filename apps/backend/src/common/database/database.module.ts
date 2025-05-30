import { Global, Module } from "@nestjs/common";

import { db } from "@repo/database";

@Global()
@Module({
  providers: [
    {
      provide: "DATABASE",
      useValue: db,
    },
  ],
  exports: ["DATABASE"],
})
export class DatabaseModule {}
