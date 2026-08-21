import { describe, expect, it } from "vitest";

import { zSharingResourceType } from "@repo/api/domains/sharing/sharing.schema";

import { GROUP_ORDER, RESOURCE_SEGMENT, RESOURCE_TYPE_COLOR } from "./organization-resource-meta";

/**
 * The showcase covers every type an organization can own, and three constants have to
 * agree on what that set is. Two of them are total `Record`s, so the compiler keeps
 * them honest. {@link GROUP_ORDER} is an array — nothing about its type says it is
 * complete, so this is what stands between a newly owned type and a page that silently
 * leaves it out: no order means no group, no filter chip, no bar segment and no
 * eligibility for the featured card.
 */
describe("the resource meta constants", () => {
  it("orders every type a grant can name, exactly once", () => {
    expect([...GROUP_ORDER].sort()).toEqual([...zSharingResourceType.options].sort());
  });

  it("gives every ordered type a colour and a platform section", () => {
    for (const type of GROUP_ORDER) {
      expect(RESOURCE_TYPE_COLOR[type], type).toMatch(/^bg-/u);
      expect(RESOURCE_SEGMENT[type], type).toBeTruthy();
    }
  });

  it("gives each type a colour of its own, so a bar segment identifies one type", () => {
    const colors = Object.values(RESOURCE_TYPE_COLOR);

    expect(new Set(colors).size).toBe(colors.length);
  });
});
