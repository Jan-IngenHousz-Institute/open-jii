import { Global, Module } from "@nestjs/common";

import { db, dbReader, dbWriter } from "@repo/database";

@Global()
@Module({
  providers: [
    {
      provide: "DATABASE",
      useValue: db,
    },
    {
      provide: "DATABASE_READER",
      useValue: dbReader,
    },
    {
      provide: "DATABASE_WRITER",
      useValue: dbWriter,
    },
  ],
  exports: ["DATABASE", "DATABASE_READER", "DATABASE_WRITER"],
})
export class DatabaseModule {}
