import { Global, Module } from "@nestjs/common";
import { db } from "database";

import * as experimentSchema from "../experiments/core/models/experiment.model";
// import * as plantSchema from "../plants/core/schemas/plant.schema";

@Global()
@Module({
  providers: [
    {
      provide: "DATABASE",
      useValue: db(
        experimentSchema,
        // ...plantSchema,
      ),
    },
  ],
  exports: ["DATABASE"],
})
export class DatabaseModule {}
