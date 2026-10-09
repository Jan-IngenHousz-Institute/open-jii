import { HealthIndicatorService } from "@nestjs/terminus";
import { Test } from "@nestjs/testing";

import { AppError, failure, success } from "../../../common/utils/fp-utils";
import { HEALTH_EMAIL_PORT } from "../../core/ports/email.port";
import { EmailHealthIndicator } from "./email.indicator";

describe("EmailHealthIndicator", () => {
  const emailPort = { verifyTransport: vi.fn() };
  let indicator: EmailHealthIndicator;

  beforeEach(async () => {
    vi.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        EmailHealthIndicator,
        HealthIndicatorService,
        { provide: HEALTH_EMAIL_PORT, useValue: emailPort },
      ],
    }).compile();
    indicator = module.get(EmailHealthIndicator);
  });

  it("reports up when the SMTP login works", async () => {
    emailPort.verifyTransport.mockResolvedValue(success(undefined));

    expect(await indicator.check()).toEqual({ email: { status: "up" } });
  });

  it("reports down with the reason when the login is refused", async () => {
    emailPort.verifyTransport.mockResolvedValue(
      failure(AppError.internal("535 Authentication failed")),
    );

    expect(await indicator.check()).toEqual({
      email: { status: "down", reason: "535 Authentication failed" },
    });
  });
});
