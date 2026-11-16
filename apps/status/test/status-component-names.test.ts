import { describe, expect, it } from "vitest";

import en from "@repo/i18n/locales/en-US/status.json";
import { STATUS_COMPONENT_IDS } from "@repo/monitoring/status-document";
import { STATUS_COMPONENT_NAMES } from "@repo/monitoring/status-slack";

describe("the component names in the Slack messages", () => {
  it.each(STATUS_COMPONENT_IDS)("match the page's English name for %s", (id) => {
    expect(STATUS_COMPONENT_NAMES[id]).toBe(en.component[id].name);
  });

  it("cover every component the page's translations name", () => {
    const named = Object.entries(en.component)
      .filter(([, value]) => typeof value === "object" && "name" in value)
      .map(([id]) => id);

    expect(named.sort()).toEqual([...STATUS_COMPONENT_IDS].sort());
  });
});
