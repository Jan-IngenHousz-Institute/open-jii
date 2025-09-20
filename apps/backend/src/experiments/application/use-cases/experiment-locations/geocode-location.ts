import { Inject, Injectable, Logger } from "@nestjs/common";

import { Result } from "../../../../common/utils/fp-utils";
import type { AwsPort, GeocodeLocationRequest, GeocodeResult } from "../../../core/ports/aws.port";
import { AWS_PORT } from "../../../core/ports/aws.port";

@Injectable()
export class GeocodeLocationUseCase {
  private readonly logger = new Logger(GeocodeLocationUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly AwsPort: AwsPort,
  ) {}

  async execute(request: GeocodeLocationRequest): Promise<Result<GeocodeResult[]>> {
    this.logger.log(`Geocoding location: lat=${request.latitude}, lon=${request.longitude}`);

    return this.AwsPort.geocodeLocation(request);
  }
}
