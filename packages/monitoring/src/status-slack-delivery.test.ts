import { describe, expect, it } from "vitest";

import { PostedIds, webhookUrlOf } from "./status-slack-delivery.js";

const HOOK = "https://hooks.slack.com/services/T000/B000/XXXX";

function errorOf(secret: string | undefined): string {
  try {
    webhookUrlOf(secret);
    return "";
  } catch (error) {
    return String(error);
  }
}

describe("webhookUrlOf", () => {
  it("takes an https address, trimmed", () => {
    expect(webhookUrlOf(`  ${HOOK}\n`)).toBe(HOOK);
  });

  it.each([
    ["nothing", undefined],
    ["an empty secret", " "],
    ["text that is not an address", "not a url"],
    ["plain http", "http://hooks.slack.com/services/T000/B000/XXXX"],
    ["a user name and password", "https://user:pass@hooks.slack.com/services/T000/B000/XXXX"],
    ["a user name alone", "https://user@hooks.slack.com/services/T000/B000/XXXX"],
  ])("refuses %s without quoting it", (_name, secret) => {
    const message = errorOf(secret);

    expect(message).toContain("does not hold an https address without credentials");
    expect(message).not.toContain("pass");
    expect(message).not.toContain("XXXX");
  });
});

describe("PostedIds", () => {
  it("remembers what was posted", () => {
    const posted = new PostedIds(3);

    posted.remember("a");

    expect(posted.has("a")).toBe(true);
    expect(posted.has("b")).toBe(false);
  });

  it("forgets the oldest once past its limit", () => {
    const posted = new PostedIds(2);

    posted.remember("a");
    posted.remember("b");
    posted.remember("c");

    expect([posted.has("a"), posted.has("b"), posted.has("c")]).toEqual([false, true, true]);
  });
});
