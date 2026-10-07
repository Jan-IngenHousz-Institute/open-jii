import { Module } from "@nestjs/common";

import { RecordExperimentVisitUseCase } from "./application/use-cases/record-experiment-visit/record-experiment-visit";
import { VisitRepository } from "./core/repositories/visit.repository";
import { VisitController } from "./presentation/visit.controller";

@Module({
  controllers: [VisitController],
  providers: [VisitRepository, RecordExperimentVisitUseCase],
})
export class VisitModule {}
