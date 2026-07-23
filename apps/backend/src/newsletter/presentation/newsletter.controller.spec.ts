import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type { NewsletterStatusResponse } from "@repo/api/domains/newsletter/newsletter.schema";

import { MailchimpAdapter } from "../../common/modules/mailchimp/mailchimp.adapter";
import { AppError, failure, success } from "../../common/utils/fp-utils";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";

// The mocked Better Auth session always resolves to this email.
const SESSION_EMAIL = "test@example.com";

describe("NewsletterController", () => {
  const testApp = TestHarness.App;
  let userId: string;
  let mailchimp: MailchimpAdapter;

  const statusPath = () => testApp.resolveOrpcPath(contract.newsletter.getStatus);
  const subscriptionPath = () => testApp.resolveOrpcPath(contract.newsletter.subscribeDirect);
  const unsubscribePath = () => testApp.resolveOrpcPath(contract.newsletter.unsubscribe);

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ email: SESSION_EMAIL });
    mailchimp = testApp.module.get(MailchimpAdapter);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("getStatus", () => {
    it("returns the live status of the session user's email", async () => {
      const spy = vi.spyOn(mailchimp, "getStatus").mockResolvedValue(success("pending"));

      const response: SuperTestResponse<NewsletterStatusResponse> = await testApp
        .get(statusPath())
        .withAuth(userId)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual({ status: "pending" });
      expect(spy).toHaveBeenCalledWith(SESSION_EMAIL);
    });

    it("returns 401 for anonymous callers", async () => {
      await testApp.get(statusPath()).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });

    it("returns 500 when the provider lookup fails", async () => {
      vi.spyOn(mailchimp, "getStatus").mockResolvedValue(
        failure(AppError.internal("Mailchimp unreachable")),
      );

      await testApp.get(statusPath()).withAuth(userId).expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });
  });

  describe("subscribeDirect", () => {
    it("directly subscribes the session user and returns the resulting status", async () => {
      const spy = vi.spyOn(mailchimp, "subscribeDirect").mockResolvedValue(success("subscribed"));

      const response: SuperTestResponse<NewsletterStatusResponse> = await testApp
        .post(subscriptionPath())
        .withAuth(userId)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual({ status: "subscribed" });
      expect(spy).toHaveBeenCalledWith(SESSION_EMAIL);
    });

    it("surfaces the pending fallback status", async () => {
      vi.spyOn(mailchimp, "subscribeDirect").mockResolvedValue(success("pending"));

      const response: SuperTestResponse<NewsletterStatusResponse> = await testApp
        .post(subscriptionPath())
        .withAuth(userId)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual({ status: "pending" });
    });

    it("returns 401 for anonymous callers", async () => {
      await testApp.post(subscriptionPath()).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("unsubscribe", () => {
    it("unsubscribes the session user", async () => {
      const spy = vi.spyOn(mailchimp, "unsubscribe").mockResolvedValue(success(undefined));

      const response: SuperTestResponse<NewsletterStatusResponse> = await testApp
        .delete(unsubscribePath())
        .withAuth(userId)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual({ status: "unsubscribed" });
      expect(spy).toHaveBeenCalledWith(SESSION_EMAIL);
    });

    it("returns 401 for anonymous callers", async () => {
      await testApp.delete(unsubscribePath()).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });
});
