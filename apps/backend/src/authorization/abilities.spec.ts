import { isPlatformAdmin, roleCan } from "./abilities";
import type { ResourceAction } from "./abilities";

const ALL_ACTIONS: ResourceAction[] = ["read", "update", "delete", "share", "manage"];

describe("abilities", () => {
  describe("roleCan", () => {
    it("grants owner and admin every action", () => {
      for (const action of ALL_ACTIONS) {
        expect(roleCan("owner", action)).toBe(true);
        expect(roleCan("admin", action)).toBe(true);
      }
    });

    it("grants member and viewer read only", () => {
      for (const role of ["member", "viewer"]) {
        expect(roleCan(role, "read")).toBe(true);
        for (const action of ALL_ACTIONS.filter((a) => a !== "read")) {
          expect(roleCan(role, action)).toBe(false);
        }
      }
    });

    it("denies unknown roles everything", () => {
      for (const action of ALL_ACTIONS) {
        expect(roleCan("stranger", action)).toBe(false);
      }
    });

    it("tolerates comma-separated multi-roles (Better Auth format)", () => {
      // A token that grants the action grants the whole role.
      expect(roleCan("admin,member", "delete")).toBe(true);
      expect(roleCan("owner,member", "update")).toBe(true);
      expect(roleCan(" member , admin ", "share")).toBe(true);
      // Only read-capable tokens → read-only.
      expect(roleCan("member,viewer", "read")).toBe(true);
      expect(roleCan("member,viewer", "update")).toBe(false);
      expect(roleCan("member,stranger", "delete")).toBe(false);
    });
  });

  describe("isPlatformAdmin", () => {
    it("is true only when an admin role is present", () => {
      expect(isPlatformAdmin("admin")).toBe(true);
      expect(isPlatformAdmin("user,admin")).toBe(true);
      expect(isPlatformAdmin(" admin , user ")).toBe(true);
    });

    it("is false for non-admin, empty, or nullish roles", () => {
      expect(isPlatformAdmin("user")).toBe(false);
      expect(isPlatformAdmin("")).toBe(false);
      expect(isPlatformAdmin(null)).toBe(false);
      expect(isPlatformAdmin(undefined)).toBe(false);
    });
  });
});
