import { Module } from '@nestjs/common';
import { ExperimentsService } from './experiments.service';
import { ExperimentsController } from './experiments.controller';

@Module({
  controllers: [ExperimentsController],
  providers: [ExperimentsService],
})
export class ExperimentsModule {} 