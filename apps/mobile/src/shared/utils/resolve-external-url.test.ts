import { describe, it, expect } from "vitest";

import { resolveExternalUrl } from "./resolve-external-url";

describe("resolveExternalUrl", () => {
  const base = "https://app.example.com/releases";

  it("returns absolute http(s) urls unchanged", () => {
    expect(resolveExternalUrl("https://docs.example.com/x", base)).toBe(
      "https://docs.example.com/x",
    );
    expect(resolveExternalUrl("http://foo.test", base)).toBe("http://foo.test");
  });

  it("returns other schemes (mailto, tel, deep links) unchanged", () => {
    expect(resolveExternalUrl("mailto:a@b.com", base)).toBe("mailto:a@b.com");
    expect(resolveExternalUrl("tel:+1234", base)).toBe("tel:+1234");
    expect(resolveExternalUrl("myapp://screen/1", base)).toBe("myapp://screen/1");
  });

  it("joins a site-relative path onto the base ORIGIN (not the base path)", () => {
    expect(resolveExternalUrl("/platform/experiments", base)).toBe(
      "https://app.example.com/platform/experiments",
    );
    expect(resolveExternalUrl("platform/experiments", base)).toBe(
      "https://app.example.com/platform/experiments",
    );
  });

  it("collapses leading slashes so the join never double-slashes", () => {
    expect(resolveExternalUrl("///foo", base)).toBe("https://app.example.com/foo");
  });

  it("returns the url unchanged when no usable http(s) base is given", () => {
    expect(resolveExternalUrl("/foo")).toBe("/foo");
    expect(resolveExternalUrl("/foo", "not-a-url")).toBe("/foo");
  });
});
