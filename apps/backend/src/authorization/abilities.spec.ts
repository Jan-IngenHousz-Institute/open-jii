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
