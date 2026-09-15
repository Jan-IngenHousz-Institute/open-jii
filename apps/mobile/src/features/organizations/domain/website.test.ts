import { describe, expect, it } from "vitest";
import { resolveOrganizationWebsite } from "~/features/organizations/domain/website";

describe("resolveOrganizationWebsite", () => {
  it("returns nothing for an absent or blank website", () => {
    expect(resolveOrganizationWebsite(null)).toBeNull();
    expect(resolveOrganizationWebsite(undefined)).toBeNull();
    expect(resolveOrganizationWebsite("")).toBeNull();
    expect(resolveOrganizationWebsite("   ")).toBeNull();
  });

  it("opens an https URL and shows it without the scheme", () => {
    expect(resolveOrganizationWebsite("https://lab.uu.nl")).toEqual({
      label: "lab.uu.nl",
      href: "https://lab.uu.nl",
    });
  });

  it("opens a plain http URL too", () => {
    expect(resolveOrganizationWebsite("http://lab.uu.nl/about")).toEqual({
      label: "lab.uu.nl/about",
      href: "http://lab.uu.nl/about",
    });
  });

  it("trims surrounding whitespace and a trailing slash from the label", () => {
    expect(resolveOrganizationWebsite("  https://lab.uu.nl/  ")).toEqual({
      label: "lab.uu.nl",
      href: "https://lab.uu.nl/",
    });
  });

  it("recognises an uppercase scheme", () => {
    const website = resolveOrganizationWebsite("HTTPS://LAB.UU.NL");
    expect(website?.href).toBe("HTTPS://LAB.UU.NL");
  });

  it("refuses to open a javascript: URL but still shows it", () => {
    expect(resolveOrganizationWebsite("javascript:alert(1)")).toEqual({
      label: "javascript:alert(1)",
      href: null,
    });
  });

  it("refuses to open a data: URL", () => {
    expect(resolveOrganizationWebsite("data:text/html,<script>x</script>")?.href).toBeNull();
  });

  it("refuses to open any other scheme", () => {
    expect(resolveOrganizationWebsite("mailto:lab@uu.nl")?.href).toBeNull();
    expect(resolveOrganizationWebsite("ftp://files.uu.nl")?.href).toBeNull();
    expect(resolveOrganizationWebsite("openjii://organizations/1")?.href).toBeNull();
  });

  it("refuses to open a schemeless value, which Linking could not resolve anyway", () => {
    expect(resolveOrganizationWebsite("lab.uu.nl")).toEqual({ label: "lab.uu.nl", href: null });
  });
});
