import { Module } from "@nestjs/common";

import { RecordVisitUseCase } from "./application/use-cases/record-visit/record-visit";
import { VisitRepository } from "./core/repositories/visit.repository";
import { VisitController } from "./presentation/visit.controller";

@Module({
  controllers: [VisitController],
  providers: [VisitRepository, RecordVisitUseCase],
})
export class VisitModule {}
