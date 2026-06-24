import { Module } from "@nestjs/common";

import { ExperimentModule } from "../experiments/experiment.module";
import { MacroModule } from "../macros/macro.module";
import { ProtocolModule } from "../protocols/protocol.module";
import { GlobalSearchUseCase } from "./application/use-cases/global-search/global-search";
import { SearchController } from "./presentation/search.controller";

@Module({
  // Imported modules export the repositories the global-search use case composes.
  imports: [ExperimentModule, ProtocolModule, MacroModule],
  controllers: [SearchController],
  providers: [GlobalSearchUseCase],
})
export class SearchModule {}
