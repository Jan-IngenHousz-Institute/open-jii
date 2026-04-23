import { describe, it, expect } from "vitest";

import { mainNavigation, userNavigation, iconMap } from "./navigation-config";

describe("navigation-config", () => {
  const locale = "en-US";

  it("exports all required icons", () => {
    const requiredIcons = [
      "LayoutDashboard",
      "Leaf",
      "FileSliders",
      "Code",
      "Settings",
      "LogOut",
      "User",
      "CirclePlus",
      "Archive",
      "BookOpen",
      "Library",
      "RadioReceiver",
      "Webcam",
      "LifeBuoy",
      "HelpCircle",
    ] as const;
    requiredIcons.forEach((icon) => expect(iconMap[icon]).toBeDefined());
  });

  describe("mainNavigation", () => {
    it.each([
      ["dashboard", `/${locale}/platform`],
      ["experiments", `/${locale}/platform/experiments`],
      ["workbooks", `/${locale}/platform/workbooks`],
    ] as const)("%s generates correct URL", (key, expected) => {
      expect(mainNavigation[key].url(locale)).toBe(expected);
    });

    it("library is not navigable and has children", () => {
      expect(mainNavigation.library.navigable).toBe(false);
      expect(mainNavigation.library.children).toBeDefined();
      expect(mainNavigation.library.children.length).toBe(2);
    });

    it("library children generate correct URLs", () => {
      const [protocols, macros] = mainNavigation.library.children;
      expect(protocols.url(locale)).toBe(`/${locale}/platform/protocols`);
      expect(macros.url(locale)).toBe(`/${locale}/platform/macros`);
    });

    it("generates sub-item URLs containing parent path", () => {
      for (const key of ["experiments"] as const) {
        mainNavigation[key].items.forEach((item) => {
          expect(item.url(locale)).toContain(mainNavigation[key].url(locale));
        });
      }
      mainNavigation.library.children.forEach((child) => {
        child.items?.forEach((item) => {
          expect(item.url(locale)).toContain(child.url(locale));
        });
      });
    });
  });

  describe("userNavigation", () => {
    it("generates account URL", () => {
      expect(userNavigation.account.url(locale)).toBe(`/${locale}/platform/account/settings`);
    });

    it("generates support URL (external)", () => {
      expect(userNavigation.support.url(locale)).toBe("https://docs.openjii.org");
      expect(userNavigation.support.external).toBe(true);
    });

    it("generates FAQ URL", () => {
      expect(userNavigation.faq.url(locale)).toBe(`/${locale}/faq`);
    });
  });
});
