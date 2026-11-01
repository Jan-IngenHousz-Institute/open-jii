import { Controller } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

import { userContract } from "@repo/api/domains/user/user.contract";

import { GetDemoAvailabilityUseCase } from "../application/use-cases/get-demo-availability/get-demo-availability";

@Controller()
@AllowAnonymous()
export class DemoAvailabilityController {
  constructor(private readonly availability: GetDemoAvailabilityUseCase) {}

  @Implement(userContract.getDemoAvailability)
  getDemoAvailability() {
    return implement(userContract.getDemoAvailability).handler(() => this.availability.execute());
  }
}
