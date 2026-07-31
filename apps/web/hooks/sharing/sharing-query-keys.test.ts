import { ANONYMOUS_PRINCIPAL } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { matchQuery } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { collaboratorsQueryKey, granteeOrganizationsQueryKey } from "./sharing-query-keys";

describe("sharing query keys", () => {
  describe("collaboratorsQueryKey", () => {
    it("gives two principals distinct cache entries for the same resource", () => {
      const forA = collaboratorsQueryKey("user-a", "macro", "macro-1");
      const forB = collaboratorsQueryKey("user-b", "macro", "macro-1");

      expect(forA).not.toEqual(forB);
    });

    it("still distinguishes resources for the same principal", () => {
      expect(collaboratorsQueryKey("user-a", "macro", "macro-1")).not.toEqual(
        collaboratorsQueryKey("user-a", "macro", "macro-2"),
      );
      expect(collaboratorsQueryKey("user-a", "macro", "res-1")).not.toEqual(
        collaboratorsQueryKey("user-a", "protocol", "res-1"),
      );
    });

    it("is stable for the same principal and resource", () => {
      expect(collaboratorsQueryKey("user-a", "macro", "macro-1")).toEqual(
        collaboratorsQueryKey("user-a", "macro", "macro-1"),
      );
    });

    it("buckets a signed-out caller under the anonymous principal", () => {
      expect(collaboratorsQueryKey(undefined, "macro", "macro-1")).toEqual(
        collaboratorsQueryKey(ANONYMOUS_PRINCIPAL, "macro", "macro-1"),
      );
    });

    it("stays matchable by the plain oRPC key, so invalidation still reaches it", () => {
      const scoped = collaboratorsQueryKey("user-a", "macro", "macro-1");

      // What the mutation hooks and any future broad invalidation use.
      expect(
        matchQuery({ queryKey: orpc.sharing.listGrants.key() }, { queryKey: scoped } as never),
      ).toBe(true);
      expect(
        matchQuery(
          {
            queryKey: orpc.sharing.listGrants.queryKey({
              input: { resourceType: "macro", id: "macro-1" },
            }),
          },
          { queryKey: scoped } as never,
        ),
      ).toBe(true);
    });
  });

  describe("granteeOrganizationsQueryKey", () => {
    it("gives two principals distinct cache entries for the same search term", () => {
      expect(granteeOrganizationsQueryKey("user-a", "lab")).not.toEqual(
        granteeOrganizationsQueryKey("user-b", "lab"),
      );
    });

    it("still distinguishes search terms for the same principal", () => {
      expect(granteeOrganizationsQueryKey("user-a", "lab")).not.toEqual(
        granteeOrganizationsQueryKey("user-a", undefined),
      );
    });

    it("stays matchable by the plain oRPC key", () => {
      expect(
        matchQuery({ queryKey: orpc.sharing.searchGranteeOrganizations.key() }, {
          queryKey: granteeOrganizationsQueryKey("user-a", "lab"),
        } as never),
      ).toBe(true);
    });
  });
});
