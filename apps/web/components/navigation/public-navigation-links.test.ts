import { describe, expect, it } from "vitest";

import { isPublicNavigationLinkActive, publicNavigationHref } from "./public-navigation-links";

describe("public navigation destinations", () => {
  it.each([
    ["/", "/de-DE"],
    ["/blog?topic=science", "/de-DE/blog?topic=science"],
    ["/#about-jii", "/de-DE#about-jii"],
    ["/en-US/faq", "/en-US/faq"],
    ["https://docs.openjii.org/guide", "https://docs.openjii.org/guide"],
  ])("resolves %s without double-prefixing locales", (input, expected) => {
    expect(publicNavigationHref(input, "de-DE")).toBe(expected);
  });

  it.each([
    "javascript:alert(1)",
    "//other.example",
    "/\\other.example",
    "https://",
    "https://user:pass@example.com",
    "/foo\nbar",
    "blog",
    "",
  ])("rejects an invalid destination: %s", (input) => {
    expect(publicNavigationHref(input, "en-US")).toBeNull();
  });

  it("matches nested paths on segment boundaries", () => {
    expect(isPublicNavigationLinkActive("/en-US/blog", "/en-US/blog/post", "en-US")).toBe(true);
    expect(isPublicNavigationLinkActive("/en-US/blog", "/en-US/blogger", "en-US")).toBe(false);
    expect(isPublicNavigationLinkActive("/en-US", "/en-US/blog", "en-US")).toBe(false);
    expect(isPublicNavigationLinkActive("/en-US", "/en-US/", "en-US")).toBe(true);
    expect(isPublicNavigationLinkActive("/en-US/platform", "/en-US/login", "en-US")).toBe(true);
    expect(isPublicNavigationLinkActive("https://example.com", "/en-US", "en-US")).toBe(false);
    expect(isPublicNavigationLinkActive("/en-US#about-jii", "/en-US", "en-US")).toBe(false);
  });
});
