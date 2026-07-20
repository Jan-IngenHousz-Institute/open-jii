import type { HttpService } from "@nestjs/axios";
import { createHash } from "crypto";

import { assertFailure, assertSuccess } from "../../utils/fp-utils";
import type { MailchimpConfigService } from "./config/config.service";
import type { MailchimpCommunityKind } from "./config/config.types";
import { MailchimpAdapter } from "./mailchimp.adapter";

const SERVER_PREFIX = "us1";
const AUDIENCE_ID = "test-audience-id";
const API_KEY = "test-mailchimp-api-key";
const COMMUNITY_ID = "community-interest-id";
const COMMUNITY_NAME = "Community";
const EMAIL = "Person@Example.com";

const expectedHash = createHash("md5").update(EMAIL.toLowerCase()).digest("hex");
const expectedMemberUrl = `https://${SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${AUDIENCE_ID}/members/${expectedHash}`;

interface MockAxiosRef {
  put: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
}

type RequestCall = [
  string,
  Record<string, unknown>,
  { auth: { username: string; password: string } },
];

const putCall = (axiosRef: MockAxiosRef, index: number): RequestCall =>
  axiosRef.put.mock.calls[index] as RequestCall;

function buildConfig(kind: MailchimpCommunityKind, isConfigured = true): MailchimpConfigService {
  return {
    isConfigured,
    apiKey: API_KEY,
    serverPrefix: SERVER_PREFIX,
    audienceId: AUDIENCE_ID,
    communityKind: kind,
    communityId: COMMUNITY_ID,
    communityName: COMMUNITY_NAME,
    baseUrl: `https://${SERVER_PREFIX}.api.mailchimp.com/3.0`,
  } as unknown as MailchimpConfigService;
}

function buildAdapter(kind: MailchimpCommunityKind = "group", isConfigured = true) {
  const axiosRef: MockAxiosRef = {
    put: vi.fn().mockResolvedValue({ data: {} }),
    get: vi.fn().mockResolvedValue({ data: { status: "subscribed" } }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  };
  const httpService = { axiosRef } as unknown as HttpService;
  const adapter = new MailchimpAdapter(buildConfig(kind, isConfigured), httpService);
  return { adapter, axiosRef };
}

function axiosError(status: number, data: unknown) {
  return { isAxiosError: true, message: `HTTP ${status}`, response: { status, data } };
}

describe("MailchimpAdapter", () => {
  describe("subscribePending", () => {
    it("upserts a pending member with the Community interest group when the address is unknown", async () => {
      const { adapter, axiosRef } = buildAdapter("group");
      axiosRef.get.mockRejectedValue(axiosError(404, { title: "Resource Not Found" }));

      const result = await adapter.subscribePending(EMAIL);

      assertSuccess(result);
      expect(axiosRef.put).toHaveBeenCalledTimes(1);
      const [url, body, config] = putCall(axiosRef, 0);
      expect(url).toBe(expectedMemberUrl);
      expect(body).toMatchObject({
        email_address: EMAIL,
        status_if_new: "pending",
        status: "pending",
        interests: { [COMMUNITY_ID]: true },
      });
      expect(config).toMatchObject({ auth: { username: "anystring", password: API_KEY } });
      expect(axiosRef.post).not.toHaveBeenCalled();
    });

    it("applies the Community tag via the tags endpoint (no interests in the body)", async () => {
      const { adapter, axiosRef } = buildAdapter("tag");
      axiosRef.get.mockRejectedValue(axiosError(404, { title: "Resource Not Found" }));

      const result = await adapter.subscribePending(EMAIL);

      assertSuccess(result);
      const [, body] = putCall(axiosRef, 0);
      expect(body).not.toHaveProperty("interests");
      expect(axiosRef.post).toHaveBeenCalledWith(
        `${expectedMemberUrl}/tags`,
        { tags: [{ name: COMMUNITY_NAME, status: "active" }] },
        expect.objectContaining({ auth: { username: "anystring", password: API_KEY } }),
      );
    });

    it("is a no-op for an already-subscribed member (never downgrades to pending)", async () => {
      const { adapter, axiosRef } = buildAdapter("group");
      axiosRef.get.mockResolvedValue({ data: { status: "subscribed" } });

      const result = await adapter.subscribePending(EMAIL);

      assertSuccess(result);
      expect(axiosRef.put).not.toHaveBeenCalled();
      expect(axiosRef.post).not.toHaveBeenCalled();
    });

    it("re-enters the pending flow for a previously unsubscribed member", async () => {
      const { adapter, axiosRef } = buildAdapter("group");
      axiosRef.get.mockResolvedValue({ data: { status: "unsubscribed" } });

      const result = await adapter.subscribePending(EMAIL);

      assertSuccess(result);
      expect(axiosRef.put).toHaveBeenCalledTimes(1);
      const [, body] = putCall(axiosRef, 0);
      expect(body).toMatchObject({ status_if_new: "pending", status: "pending" });
    });

    it("re-issues the pending upsert for a member already in pending state", async () => {
      const { adapter, axiosRef } = buildAdapter("group");
      axiosRef.get.mockResolvedValue({ data: { status: "pending" } });

      const result = await adapter.subscribePending(EMAIL);

      assertSuccess(result);
      expect(axiosRef.put).toHaveBeenCalledTimes(1);
      const [, body] = putCall(axiosRef, 0);
      expect(body).toMatchObject({ status_if_new: "pending", status: "pending" });
    });

    it("returns failure without upserting when the status lookup fails", async () => {
      const { adapter, axiosRef } = buildAdapter("group");
      axiosRef.get.mockRejectedValue(axiosError(500, { detail: "lookup boom" }));

      const result = await adapter.subscribePending(EMAIL);

      assertFailure(result);
      expect(axiosRef.put).not.toHaveBeenCalled();
    });

    it("returns failure when the upsert request fails", async () => {
      const { adapter, axiosRef } = buildAdapter("group");
      axiosRef.get.mockRejectedValue(axiosError(404, { title: "Resource Not Found" }));
      axiosRef.put.mockRejectedValue(axiosError(500, { detail: "boom" }));

      const result = await adapter.subscribePending(EMAIL);

      assertFailure(result);
    });
  });

  describe("subscribeDirect", () => {
    it("upserts a subscribed member and returns subscribed", async () => {
      const { adapter, axiosRef } = buildAdapter("group");

      const result = await adapter.subscribeDirect(EMAIL);

      assertSuccess(result);
      expect(result.value).toBe("subscribed");
      const [, body] = putCall(axiosRef, 0);
      expect(body).toMatchObject({ status_if_new: "subscribed", status: "subscribed" });
    });

    it("falls back to pending when Mailchimp rejects with a compliance state", async () => {
      const { adapter, axiosRef } = buildAdapter("group");
      axiosRef.put
        .mockRejectedValueOnce(axiosError(400, { title: "Member In Compliance State" }))
        .mockResolvedValueOnce({ data: {} });

      const result = await adapter.subscribeDirect(EMAIL);

      assertSuccess(result);
      expect(result.value).toBe("pending");
      expect(axiosRef.put).toHaveBeenCalledTimes(2);
      const [, secondBody] = putCall(axiosRef, 1);
      expect(secondBody).toMatchObject({ status_if_new: "pending", status: "pending" });
    });

    it("returns failure for a non-compliance error", async () => {
      const { adapter, axiosRef } = buildAdapter("group");
      axiosRef.put.mockRejectedValue(axiosError(500, { detail: "server error" }));

      const result = await adapter.subscribeDirect(EMAIL);

      assertFailure(result);
      expect(axiosRef.put).toHaveBeenCalledTimes(1);
    });
  });

  describe("getStatus", () => {
    it.each([
      ["subscribed", "subscribed"],
      ["pending", "pending"],
      ["unsubscribed", "unsubscribed"],
      ["cleaned", "unsubscribed"],
      ["transactional", "unsubscribed"],
      ["archived", "unsubscribed"],
    ])("maps Mailchimp status %s to %s", async (mailchimpStatus, expected) => {
      const { adapter, axiosRef } = buildAdapter("group");
      axiosRef.get.mockResolvedValue({ data: { status: mailchimpStatus } });

      const result = await adapter.getStatus(EMAIL);

      assertSuccess(result);
      expect(result.value).toBe(expected);
      expect(axiosRef.get).toHaveBeenCalledWith(expectedMemberUrl, expect.anything());
    });

    it("fails closed for an unknown provider status instead of guessing", async () => {
      const { adapter, axiosRef } = buildAdapter("group");
      axiosRef.get.mockResolvedValue({ data: { status: "quantum-superposition" } });

      const result = await adapter.getStatus(EMAIL);

      assertFailure(result);
    });

    it("fails closed when the response is missing a status field", async () => {
      const { adapter, axiosRef } = buildAdapter("group");
      axiosRef.get.mockResolvedValue({ data: {} });

      const result = await adapter.getStatus(EMAIL);

      assertFailure(result);
    });

    it("returns none when the member does not exist", async () => {
      const { adapter, axiosRef } = buildAdapter("group");
      axiosRef.get.mockRejectedValue(axiosError(404, { title: "Resource Not Found" }));

      const result = await adapter.getStatus(EMAIL);

      assertSuccess(result);
      expect(result.value).toBe("none");
    });

    it("returns failure on non-404 errors", async () => {
      const { adapter, axiosRef } = buildAdapter("group");
      axiosRef.get.mockRejectedValue(axiosError(500, { detail: "boom" }));

      const result = await adapter.getStatus(EMAIL);

      assertFailure(result);
    });
  });

  describe("unsubscribe", () => {
    it("patches the member to unsubscribed", async () => {
      const { adapter, axiosRef } = buildAdapter("group");

      const result = await adapter.unsubscribe(EMAIL);

      assertSuccess(result);
      expect(axiosRef.patch).toHaveBeenCalledWith(
        expectedMemberUrl,
        { status: "unsubscribed" },
        expect.anything(),
      );
    });

    it("treats a missing member as a successful no-op", async () => {
      const { adapter, axiosRef } = buildAdapter("group");
      axiosRef.patch.mockRejectedValue(axiosError(404, { title: "Resource Not Found" }));

      const result = await adapter.unsubscribe(EMAIL);

      assertSuccess(result);
    });
  });

  describe("deleteMember", () => {
    it("permanently deletes the member", async () => {
      const { adapter, axiosRef } = buildAdapter("group");

      const result = await adapter.deleteMember(EMAIL);

      assertSuccess(result);
      expect(axiosRef.post).toHaveBeenCalledWith(
        `${expectedMemberUrl}/actions/delete-permanent`,
        undefined,
        expect.anything(),
      );
    });

    it("treats a missing member as already erased", async () => {
      const { adapter, axiosRef } = buildAdapter("group");
      axiosRef.post.mockRejectedValue(axiosError(404, { title: "Resource Not Found" }));

      const result = await adapter.deleteMember(EMAIL);

      assertSuccess(result);
    });
  });

  describe("when Mailchimp is not configured", () => {
    it("returns failure from every operation without making any HTTP call", async () => {
      const { adapter, axiosRef } = buildAdapter("group", false);

      const results = [
        await adapter.subscribePending(EMAIL),
        await adapter.subscribeDirect(EMAIL),
        await adapter.unsubscribe(EMAIL),
        await adapter.getStatus(EMAIL),
        await adapter.deleteMember(EMAIL),
      ];

      for (const result of results) {
        assertFailure(result);
      }
      expect(axiosRef.get).not.toHaveBeenCalled();
      expect(axiosRef.put).not.toHaveBeenCalled();
      expect(axiosRef.patch).not.toHaveBeenCalled();
      expect(axiosRef.post).not.toHaveBeenCalled();
    });
  });
});
