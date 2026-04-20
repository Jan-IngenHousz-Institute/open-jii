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
      ["protocols", `/${locale}/platform/protocols`],
      ["macros", `/${locale}/platform/macros`],
    ] as const)("%s generates correct URL", (key, expected) => {
      expect(mainNavigation[key].url(locale)).toBe(expected);
    });

    it("generates sub-item URLs containing parent path", () => {
      for (const key of ["experiments", "protocols", "macros"] as const) {
        mainNavigation[key].items.forEach((item) => {
          expect(item.url(locale)).toContain(mainNavigation[key].url(locale));
        });
      }
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
