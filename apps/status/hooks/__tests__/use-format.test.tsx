import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { TranslationsProvider } from "~/components/translations-provider";

import { loadNamespaceBundles } from "@repo/i18n/server";

import { useFormat } from "../use-format";

const MINUTE_MS = 60_000;

const bundles = {
  "en-US": await loadNamespaceBundles("en-US", ["status"]),
  "de-DE": await loadNamespaceBundles("de-DE", ["status"]),
};

function formatIn(locale: keyof typeof bundles) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <TranslationsProvider locale={locale} namespaces={["status"]} resources={bundles[locale]}>
        {children}
      </TranslationsProvider>
    );
  }

  return renderHook(() => useFormat(), { wrapper: Wrapper }).result.current;
}

describe("useFormat", () => {
  describe("duration", () => {
    it.each([
      [0, "0 min"],
      [45, "45 min"],
      [60, "1 h"],
      [95, "1 h 35 min"],
      [1439, "23 h 59 min"],
      [1440, "1 d"],
      [1500, "1 d 1 h"],
      [5490, "3 d 19 h"],
    ])("writes %i minutes as %s", (minutes, expected) => {
      expect(formatIn("en-US").duration(minutes)).toBe(expected);
    });

    it("writes days in the page language", () => {
      expect(formatIn("de-DE").duration(5490)).toBe("3 Tg. 19 Std.");
    });
  });

  describe("ago", () => {
    it("rounds down to whole minutes", () => {
      const { ago } = formatIn("en-US");

      expect(ago(59_999)).toBe("just now");
      expect(ago(MINUTE_MS)).toBe("1 min ago");
      expect(ago(125 * MINUTE_MS)).toBe("2 h 5 min ago");
    });

    it("counts days for data that old", () => {
      expect(formatIn("en-US").ago(5490 * MINUTE_MS)).toBe("3 d 19 h ago");
    });

    it("reads a time in the future as just now", () => {
      const { ago } = formatIn("en-US");

      expect(ago(-1)).toBe("just now");
      expect(ago(-30 * MINUTE_MS)).toBe("just now");
    });
  });

  describe("uptime", () => {
    it("always shows two decimals, so neighbouring figures line up", () => {
      const { uptime } = formatIn("en-US");

      expect(uptime(99.97)).toBe("99.97%");
      expect(uptime(99.9)).toBe("99.90%");
      expect(uptime(99.99)).toBe("99.99%");
      expect(uptime(0)).toBe("0.00%");
    });

    it("shows exactly 100 as 100", () => {
      expect(formatIn("en-US").uptime(100)).toBe("100%");
      expect(formatIn("de-DE").uptime(100)).toMatch(/^100\s%$/);
    });

    it("follows the page language", () => {
      expect(formatIn("de-DE").uptime(99.97)).toMatch(/^99,97\s%$/);
    });
  });

  describe("lists", () => {
    it("joins names in the page language", () => {
      const names = ["Website", "Plattform", "Makro-Verarbeitung"];

      expect(formatIn("en-US").names(names)).toBe("Website, Plattform, and Makro-Verarbeitung");
      expect(formatIn("de-DE").names(names)).toBe("Website, Plattform und Makro-Verarbeitung");
    });

    it("joins clauses without a conjunction", () => {
      expect(formatIn("en-US").clauses(["Outage for 42 min", "Degraded for 9 min"])).toBe(
        "Outage for 42 min, Degraded for 9 min",
      );
    });
  });

  describe("dates", () => {
    it("names months in the page language", () => {
      expect(formatIn("en-US").date("2026-11-03")).toBe("November 3, 2026");
      expect(formatIn("de-DE").date("2026-11-03")).toBe("3. November 2026");
    });

    it("reads every date and time in UTC, whatever the zone of the machine", () => {
      const format = formatIn("en-US");
      const iso = "2026-11-03T03:30:00.000Z";

      expect(format.date(iso)).toBe("November 3, 2026");
      expect(format.shortDate(iso)).toBe("Nov 3, 2026");
      expect(format.monthDay(iso)).toBe("Nov 3");
      expect(format.weekdayDate(iso)).toBe("Tuesday, November 3, 2026");
      expect(format.time(iso)).toBe("03:30");
      expect(format.dateTime(iso)).toContain("03:30");
    });

    it("writes the time on a 24 hour clock in every language", () => {
      expect(formatIn("de-DE").time("2026-11-03T15:05:00.000Z")).toBe("15:05");
      expect(formatIn("en-US").time("2026-11-03T15:05:00.000Z")).toBe("15:05");
    });
  });
});
