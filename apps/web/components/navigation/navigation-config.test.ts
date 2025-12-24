import { describe, it, expect } from "vitest";

import { mainNavigation, userNavigation, iconMap } from "./navigation-config";

describe("navigation-config", () => {
  const testLocale = "en-US";

  describe("iconMap", () => {
    it("exports all required icons", () => {
      expect(iconMap.Home).toBeDefined();
      expect(iconMap.Microscope).toBeDefined();
      expect(iconMap.FileSliders).toBeDefined();
      expect(iconMap.Code).toBeDefined();
      expect(iconMap.Settings).toBeDefined();
      expect(iconMap.LogOut).toBeDefined();
      expect(iconMap.User).toBeDefined();
      expect(iconMap.CirclePlus).toBeDefined();
      expect(iconMap.Archive).toBeDefined();
      expect(iconMap.BookOpen).toBeDefined();
      expect(iconMap.RadioReceiver).toBeDefined();
      expect(iconMap.Webcam).toBeDefined();
      expect(iconMap.LifeBuoy).toBeDefined();
      expect(iconMap.HelpCircle).toBeDefined();
    });
  });

  describe("mainNavigation", () => {
    it("generates dashboard URL correctly", () => {
      const url = mainNavigation.dashboard.url(testLocale);
      expect(url).toBe(`/${testLocale}/platform`);
    });

    it("generates experiments URLs correctly", () => {
      const url = mainNavigation.experiments.url(testLocale);
      expect(url).toBe(`/${testLocale}/platform/experiments`);

      mainNavigation.experiments.items.forEach((item) => {
        const itemUrl = item.url(testLocale);
        expect(itemUrl).toContain(`/${testLocale}/platform/experiments`);
      });
    });

    it("generates protocols URLs correctly", () => {
      const url = mainNavigation.protocols.url(testLocale);
      expect(url).toBe(`/${testLocale}/platform/protocols`);

      mainNavigation.protocols.items.forEach((item) => {
        const itemUrl = item.url(testLocale);
        expect(itemUrl).toContain(`/${testLocale}/platform/protocols`);
      });
    });

    it("generates macros URLs correctly", () => {
      const url = mainNavigation.macros.url(testLocale);
      expect(url).toBe(`/${testLocale}/platform/macros`);

      mainNavigation.macros.items.forEach((item) => {
        const itemUrl = item.url(testLocale);
        expect(itemUrl).toContain(`/${testLocale}/platform/macros`);
      });
    });
  });

  describe("userNavigation", () => {
    it("generates account URL correctly", () => {
      const url = userNavigation.account.url(testLocale);
      expect(url).toBe(`/${testLocale}/platform/account/settings`);
    });

    it("generates support URL correctly", () => {
      const url = userNavigation.support.url(testLocale);
      expect(url).toBe("https://docs.openjii.org");
      expect(userNavigation.support.external).toBe(true);
    });

    it("generates FAQ URL correctly", () => {
      const url = userNavigation.faq.url(testLocale);
      expect(url).toBe(`/${testLocale}/faq`);
    });

    it("generates logout URL correctly", () => {
      const url = userNavigation.logout.url(testLocale);
      expect(url).toBe(`/${testLocale}/platform/signout`);
    });
  });
});
