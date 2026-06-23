import { Inject, Injectable, Logger } from "@nestjs/common";

import type { ExperimentPlaceSearchResult } from "@repo/api/domains/experiment/experiment.schema";

import { Result } from "../../../../common/utils/fp-utils";
import type { AwsPort, SearchPlacesRequest } from "../../../core/ports/aws.port";
import { AWS_PORT } from "../../../core/ports/aws.port";

@Injectable()
export class SearchPlacesUseCase {
  private readonly logger = new Logger(SearchPlacesUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly AwsPort: AwsPort,
  ) {}

  async execute(request: SearchPlacesRequest): Promise<Result<ExperimentPlaceSearchResult[]>> {
    this.logger.log({
      msg: "Searching places",
      operation: "searchPlaces",
      query: request.query,
    });

    return this.AwsPort.searchPlaces(request);
  }
}
