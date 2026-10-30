import { createGranteeUser } from "@/test/factories";
import { describe, expect, it } from "vitest";

import type { ShareContext } from "./share-candidates";
import { describeGroup, describeShareUser } from "./share-candidates";

const t = (key: string) => key;

function context(overrides: Partial<ShareContext> = {}): ShareContext {
  return {
    resourceType: "experiment",
    role: "viewer",
    typedEmail: null,
    existingGrants: [],
    owningOrganizationId: null,
    t,
    ...overrides,
  };
}

describe("share context: people", () => {
  it.each([
    // [organization role, existing share, level, reason]
    [null, null, "viewer", null],
    [null, null, "admin", null],
    ["owner", null, "viewer", "sharing.granteeHasFullAccess"],
    ["owner", null, "admin", "sharing.granteeHasFullAccess"],
    ["admin", null, "viewer", "sharing.granteeHasFullAccess"],
    ["admin", null, "admin", "sharing.granteeHasFullAccess"],
    ["member", null, "viewer", "sharing.granteeTierAddsNothing"],
    ["member", null, "admin", null],
    [null, "viewer", "viewer", "sharing.granteeTierAddsNothing"],
    [null, "viewer", "admin", null],
    [null, "admin", "viewer", "sharing.granteeHasFullAccessViaGrant"],
    [null, "admin", "admin", "sharing.granteeHasFullAccessViaGrant"],
  ] as const)(
    "org role %s with share %s at level %s is greyed out with %s",
    (organizationRole, existingGrantRole, role, reason) => {
      const row = describeShareUser(
        createGranteeUser({ organizationRole, existingGrantRole }),
        context({ role }),
      );

      expect(row.unavailableReason).toBe(reason);
    },
  );

  it("badges the organization role and the existing share", () => {
    const row = describeShareUser(
      createGranteeUser({ organizationRole: "member", existingGrantRole: "viewer" }),
      context(),
    );

    expect(row.badges).toEqual(["sharing.orgMemberBadge", "sharing.roleCanView"]);
  });

  it("carries the access along with the pick, so the host can re-check the level", () => {
    const row = describeShareUser(
      createGranteeUser({ userId: "u-1", firstName: "Lin", lastName: "Zhao", email: null }),
      context(),
    );

    expect(row.value).toEqual({
      type: "user",
      id: "u-1",
      displayName: "Lin Zhao",
      access: { organizationRole: null, existingGrantRole: null },
    });
  });

  it("names a nameless person by the rule, never by id", () => {
    const row = describeShareUser(
      createGranteeUser({ userId: "u-1", firstName: "", lastName: "", email: null }),
      context(),
    );

    expect(row.label).toBe("common.unnamedAccount");
    expect(row.value.displayName).toBe("common.unnamedAccount");
  });
});

describe("share context: teams and organizations", () => {
  const team = { id: "team-1", name: "Imaging" };
  const organization = { id: "org-1", name: "Greenhouse Lab" };
  const describeShareTeam = (ctx: ShareContext) => describeGroup("team", team, "4", ctx);
  const describeShareOrganization = (ctx: ShareContext) =>
    describeGroup("organization", organization, "Organization", ctx);

  it("states an existing share and greys out a level that adds nothing", () => {
    const existingGrants = [
      { granteeType: "team" as const, granteeId: "team-1", role: "viewer" as const },
    ];
    const atViewer = describeShareTeam(context({ existingGrants }));
    const atAdmin = describeShareTeam(context({ existingGrants, role: "admin" }));

    expect(atViewer.badges).toEqual(["sharing.roleCanView"]);
    expect(atViewer.unavailableReason).toBe("sharing.granteeTierAddsNothing");
    expect(atAdmin.unavailableReason).toBeNull();
  });

  it("greys out an organization that already has Can edit at every level", () => {
    const existingGrants = [
      { granteeType: "organization" as const, granteeId: "org-1", role: "admin" as const },
    ];

    for (const role of ["viewer", "admin"] as const) {
      expect(describeShareOrganization(context({ existingGrants, role })).unavailableReason).toBe(
        "sharing.granteeHasFullAccessViaGrant",
      );
    }
  });

  it("matches a grant by type as well as id", () => {
    const existingGrants = [
      { granteeType: "organization" as const, granteeId: "team-1", role: "admin" as const },
    ];
    const row = describeShareTeam(context({ existingGrants }));

    expect(row.badges).toEqual([]);
    expect(row.unavailableReason).toBeNull();
  });

  it.each([
    ["experiment", "sharing.ownsResource.experiment"],
    ["macro", "sharing.ownsResource.macro"],
    ["protocol", "sharing.ownsResource.protocol"],
    ["workbook", "sharing.ownsResource.workbook"],
    ["device", "sharing.ownsResource.device"],
    ["device_group", "sharing.ownsResource.deviceGroup"],
    ["calibration_definition", "sharing.ownsResource.calibrationDefinition"],
  ] as const)(
    "greys out the organization that owns a %s at every level",
    (resourceType, reason) => {
      for (const role of ["viewer", "admin"] as const) {
        expect(
          describeShareOrganization(context({ resourceType, role, owningOrganizationId: "org-1" }))
            .unavailableReason,
        ).toBe(reason);
      }
    },
  );

  it("leaves every other organization, and a team with the owner's id, to the share rule", () => {
    const owned = context({ role: "admin", owningOrganizationId: "other-org" });

    expect(describeShareOrganization(owned).unavailableReason).toBeNull();
    expect(
      describeGroup("team", { id: "org-1", name: "Imaging" }, "4", {
        ...owned,
        owningOrganizationId: "org-1",
      }).unavailableReason,
    ).toBeNull();
  });

  it("leaves a group without a share pickable and unbadged", () => {
    const row = describeShareOrganization(context());

    expect(row.badges).toEqual([]);
    expect(row.unavailableReason).toBeNull();
    expect(row.value.access).toEqual({ organizationRole: null, existingGrantRole: null });
  });
});
