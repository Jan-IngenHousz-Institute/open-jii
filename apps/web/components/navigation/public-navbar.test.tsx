import { render, screen } from "@/test/test-utils";
import { draftMode } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getContentfulClients } from "~/lib/contentful";

import { PublicNavbar } from "./public-navbar";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/components/language-switcher", () => ({ LanguageSwitcher: () => null }));

const published = vi.fn();
const preview = vi.fn();
const result = {
  footerCollection: {
    items: [
      {
        navigationButtonsCollection: {
          items: [
            { sys: { id: "guides" }, label: "Guides", url: "https://docs.openjii.org/" },
            null,
            { sys: { id: "invalid" }, label: "Unsafe", url: "javascript:alert(1)" },
            { sys: { id: "blog" }, label: "News", url: "/blog" },
          ],
        },
      },
    ],
  },
};

beforeEach(() => {
  published.mockReset().mockResolvedValue(result);
  preview.mockReset().mockResolvedValue(result);
  vi.mocked(draftMode).mockResolvedValue({ isEnabled: false } as never);
  vi.mocked(getContentfulClients).mockResolvedValue({
    client: { publicNavigation: published },
    previewClient: { publicNavigation: preview },
  } as never);
});

describe("CMS public navigation", () => {
  it("renders published links and ignores unresolved or unsafe destinations", async () => {
    render(await PublicNavbar({ locale: "en-US" }));
    expect(screen.getByRole("link", { name: "Guides" })).toHaveAttribute(
      "href",
      "https://docs.openjii.org/",
    );
    expect(screen.getByRole("link", { name: "News" })).toHaveAttribute("href", "/en-US/blog");
    expect(screen.queryByText("Unsafe")).not.toBeInTheDocument();
    expect(published).toHaveBeenCalledWith({ locale: "en-US", preview: false });
    expect(preview).not.toHaveBeenCalled();
  });

  it("fetches unpublished navigation through the preview client", async () => {
    vi.mocked(draftMode).mockResolvedValue({ isEnabled: true } as never);
    await PublicNavbar({ locale: "de-DE" });
    expect(preview).toHaveBeenCalledWith({ locale: "de-DE", preview: true });
    expect(published).not.toHaveBeenCalled();
  });

  it("keeps essential routes reachable when the CMS fails", async () => {
    published.mockRejectedValue(new Error("unavailable"));
    render(await PublicNavbar({ locale: "en-US" }));
    expect(screen.getByRole("link", { name: "navigation.home" })).toHaveAttribute("href", "/en-US");
    expect(screen.getByRole("link", { name: "navigation.platform" })).toHaveAttribute(
      "href",
      "/en-US/platform",
    );
  });

  it("honors an empty published list", async () => {
    published.mockResolvedValue({
      footerCollection: { items: [{ navigationButtonsCollection: { items: [] } }] },
    });
    render(await PublicNavbar({ locale: "en-US" }));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
