import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type { NewsletterSubscribeResponse } from "@repo/api/domains/newsletter/newsletter.schema";

import { MailchimpAdapter } from "../../common/modules/mailchimp/mailchimp.adapter";
import { AppError, failure, success } from "../../common/utils/fp-utils";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";

describe("NewsletterSubscribeController", () => {
  const testApp = TestHarness.App;
  const subscribePath = () => testApp.resolveOrpcPath(contract.newsletter.subscribe);
  const statusPath = () => testApp.resolveOrpcPath(contract.newsletter.getStatus);
  let mailchimp: MailchimpAdapter;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    mailchimp = testApp.module.get(MailchimpAdapter);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("subscribes without a session and returns a generic response", async () => {
    const spy = vi.spyOn(mailchimp, "subscribePending").mockResolvedValue(success(undefined));

    const response: SuperTestResponse<NewsletterSubscribeResponse> = await testApp
      .post(subscribePath())
      .withoutAuth()
      .set("X-Forwarded-For", "203.0.113.10")
      .send({ email: "visitor@example.com" })
      .expect(StatusCodes.OK);

    expect(response.body).toEqual({ success: true });
    expect(spy).toHaveBeenCalledWith("visitor@example.com");
  });

  it("returns the same generic response when the provider returns a failure", async () => {
    vi.spyOn(mailchimp, "subscribePending").mockResolvedValue(
      failure(AppError.internal("Mailchimp down")),
    );

    const response: SuperTestResponse<NewsletterSubscribeResponse> = await testApp
      .post(subscribePath())
      .withoutAuth()
      .set("X-Forwarded-For", "203.0.113.11")
      .send({ email: "visitor2@example.com" })
      .expect(StatusCodes.OK);

    expect(response.body).toEqual({ success: true });
  });

  it("returns the same generic response when the provider throws (no enumeration signal)", async () => {
    vi.spyOn(mailchimp, "subscribePending").mockRejectedValue(new Error("unexpected boom"));

    const response: SuperTestResponse<NewsletterSubscribeResponse> = await testApp
      .post(subscribePath())
      .withoutAuth()
      .set("X-Forwarded-For", "203.0.113.12")
      .send({ email: "visitor3@example.com" })
      .expect(StatusCodes.OK);

    expect(response.body).toEqual({ success: true });
  });

  it("rejects an invalid email address", async () => {
    await testApp
      .post(subscribePath())
      .withoutAuth()
      .set("X-Forwarded-For", "203.0.113.13")
      .send({ email: "not-an-email" })
      .expect(StatusCodes.BAD_REQUEST);
  });

  // Deployed header shape: `<client-supplied...>, <viewer-IP by CloudFront>, <edge-IP by ALB>`.
  // The client key is the second-from-right entry.
  const EDGE_IP = "70.132.0.1";

  it("allows exactly five requests per client per window, then returns 429", async () => {
    vi.spyOn(mailchimp, "subscribePending").mockResolvedValue(success(undefined));

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const response = await testApp
        .post(subscribePath())
        .withoutAuth()
        .set("X-Forwarded-For", `198.51.100.1, ${EDGE_IP}`)
        .send({ email: `flood${i}@example.com` });
      statuses.push(response.status);
    }

    expect(statuses).toEqual([
      StatusCodes.OK,
      StatusCodes.OK,
      StatusCodes.OK,
      StatusCodes.OK,
      StatusCodes.OK,
      StatusCodes.TOO_MANY_REQUESTS,
    ]);
  });

  it("keys the limit per client IP so distinct forwarded clients are independent", async () => {
    vi.spyOn(mailchimp, "subscribePending").mockResolvedValue(success(undefined));

    // Exhaust client A's bucket (A is the second-from-right entry).
    for (let i = 0; i < 5; i++) {
      await testApp
        .post(subscribePath())
        .withoutAuth()
        .set("X-Forwarded-For", `198.51.100.2, ${EDGE_IP}`)
        .send({ email: `a${i}@example.com` })
        .expect(StatusCodes.OK);
    }
    await testApp
      .post(subscribePath())
      .withoutAuth()
      .set("X-Forwarded-For", `198.51.100.2, ${EDGE_IP}`)
      .send({ email: "a-blocked@example.com" })
      .expect(StatusCodes.TOO_MANY_REQUESTS);

    // A different forwarded client is unaffected.
    await testApp
      .post(subscribePath())
      .withoutAuth()
      .set("X-Forwarded-For", `198.51.100.3, ${EDGE_IP}`)
      .send({ email: "b@example.com" })
      .expect(StatusCodes.OK);
  });

  it("cannot be bypassed by spoofing the leftmost X-Forwarded-For entry", async () => {
    vi.spyOn(mailchimp, "subscribePending").mockResolvedValue(success(undefined));

    // Same real client (second-from-right = 198.51.100.4) but a different
    // attacker-controlled leftmost entry on every request. They must all land
    // in the same bucket, so the sixth is still throttled.
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const response = await testApp
        .post(subscribePath())
        .withoutAuth()
        .set("X-Forwarded-For", `10.0.0.${i}, 198.51.100.4, ${EDGE_IP}`)
        .send({ email: `spoof${i}@example.com` });
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 5)).toEqual([
      StatusCodes.OK,
      StatusCodes.OK,
      StatusCodes.OK,
      StatusCodes.OK,
      StatusCodes.OK,
    ]);
    expect(statuses[5]).toBe(StatusCodes.TOO_MANY_REQUESTS);
  });

  it("does not throttle the authenticated newsletter routes", async () => {
    vi.spyOn(mailchimp, "getStatus").mockResolvedValue(success("subscribed"));

    // Well beyond the anonymous limit, all from one address, all authenticated.
    for (let i = 0; i < 8; i++) {
      await testApp
        .get(statusPath())
        .withAuth("11111111-1111-1111-1111-111111111111")
        .set("X-Forwarded-For", "198.51.100.9")
        .expect(StatusCodes.OK);
    }
  });
});
