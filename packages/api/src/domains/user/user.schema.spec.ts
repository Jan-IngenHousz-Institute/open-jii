import { describe, it, expect } from "vitest";

import {
  zUser,
  zUserList,
  zSearchUsersQuery,
  zCreateUserProfileBody,
  zUserIdPathParam,
  zInvitation,
} from "./user.schema";

describe("User Schema", () => {
  describe("zUser", () => {
    it("should validate a valid user object", () => {
      const validUser = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "John Doe",
        email: "john.doe@example.com",
        emailVerified: true,
        image: "https://example.com/avatar.jpg",
        createdAt: "2024-01-15T10:00:00Z",
        registered: true,
      };

      const result = zUser.parse(validUser);
      expect(result).toEqual(validUser);
    });

    it("should allow nullable fields", () => {
      const userWithNulls = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: null,
        email: null,
        emailVerified: false,
        image: null,
        createdAt: "2024-01-15T10:00:00Z",
        registered: false,
      };

      const result = zUser.parse(userWithNulls);
      expect(result).toEqual(userWithNulls);
    });

    it("should reject invalid UUID", () => {
      const invalidUser = {
        id: "invalid-uuid",
        name: "John Doe",
        email: "john.doe@example.com",
        emailVerified: false,
        image: null,
        createdAt: "2024-01-15T10:00:00Z",
        registered: true,
      };

      expect(() => zUser.parse(invalidUser)).toThrow();
    });

    it("accepts a stored non-email value (ORCID signups have placeholder emails)", () => {
      const orcidUser = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "John Doe",
        email: "0000-0002-1825-0097",
        emailVerified: false,
        image: null,
        createdAt: "2024-01-15T10:00:00Z",
        registered: true,
      };

      expect(zUser.parse(orcidUser).email).toBe("0000-0002-1825-0097");
    });
  });

  describe("zUserList", () => {
    it("should validate an array of users", () => {
      const userList = [
        {
          id: "123e4567-e89b-12d3-a456-426614174000",
          name: "John Doe",
          email: "john.doe@example.com",
          emailVerified: true,
          image: null,
          createdAt: "2024-01-15T10:00:00Z",
          registered: true,
        },
        {
          id: "456e7890-e12b-34d5-a789-123456789000",
          name: "Jane Smith",
          email: "jane.smith@example.com",
          emailVerified: false,
          image: null,
          createdAt: "2024-01-15T11:00:00Z",
          registered: false,
        },
      ];

      const result = zUserList.parse(userList);
      expect(result).toEqual(userList);
    });

    it("should validate an empty array", () => {
      const result = zUserList.parse([]);
      expect(result).toEqual([]);
    });
  });

  describe("zSearchUsersQuery", () => {
    it("should parse valid search query with all fields", () => {
      const query = {
        query: "john",
        limit: 20,
        offset: 10,
      };

      const result = zSearchUsersQuery.parse(query);
      expect(result).toEqual(query);
    });

    it("defaults to 20 results from the start", () => {
      const result = zSearchUsersQuery.parse({ query: "jo" });

      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    it("trims the query", () => {
      expect(zSearchUsersQuery.parse({ query: "  jo  " }).query).toBe("jo");
    });

    it.each([
      ["missing", {}],
      ["empty", { query: "" }],
      ["one character", { query: "a" }],
      ["one character padded with spaces", { query: "  a  " }],
    ])("rejects a %s query", (_label, query) => {
      expect(zSearchUsersQuery.safeParse(query).success).toBe(false);
    });

    it("should coerce string numbers", () => {
      const query = {
        query: "jo",
        limit: "10",
        offset: "5",
      };

      const result = zSearchUsersQuery.parse(query);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(5);
    });

    it.each([0, 21, 100])("rejects limit %i rather than clamping it", (limit) => {
      expect(zSearchUsersQuery.safeParse({ query: "jo", limit }).success).toBe(false);
    });

    it("should reject negative offset", () => {
      const query = { query: "jo", offset: -1 };
      expect(() => zSearchUsersQuery.parse(query)).toThrow();
    });
  });

  describe("zCreateUserProfileBody", () => {
    it("should validate required fields", () => {
      const profile = {
        firstName: "John",
        lastName: "Doe",
      };

      const result = zCreateUserProfileBody.parse(profile);
      expect(result).toEqual(profile);
    });

    it("should validate with optional bio", () => {
      const profile = {
        firstName: "John",
        lastName: "Doe",
        bio: "Software developer with 5 years of experience.",
      };

      const result = zCreateUserProfileBody.parse(profile);
      expect(result).toEqual(profile);
    });

    it("should validate with all optional fields", () => {
      const profile = {
        firstName: "John",
        lastName: "Doe",
        bio: "Software developer with 5 years of experience.",
      };

      const result = zCreateUserProfileBody.parse(profile);
      expect(result).toEqual(profile);
    });

    it("should reject short first name", () => {
      const profile = {
        firstName: "J",
        lastName: "Doe",
      };

      expect(() => zCreateUserProfileBody.parse(profile)).toThrow();
    });

    it("should reject short last name", () => {
      const profile = {
        firstName: "John",
        lastName: "D",
      };

      expect(() => zCreateUserProfileBody.parse(profile)).toThrow();
    });
  });

  describe("zUserIdPathParam", () => {
    it("should validate valid UUID", () => {
      const param = { id: "123e4567-e89b-12d3-a456-426614174000" };
      const result = zUserIdPathParam.parse(param);
      expect(result).toEqual(param);
    });

    it("should reject invalid UUID", () => {
      const param = { id: "invalid-uuid" };
      expect(() => zUserIdPathParam.parse(param)).toThrow();
    });
  });

  describe("zInvitation", () => {
    const invitation = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      resourceType: "experiment",
      resourceId: "123e4567-e89b-12d3-a456-426614174001",
      email: "invitee@example.com",
      tier: "viewer",
      status: "pending",
      invitedBy: "123e4567-e89b-12d3-a456-426614174002",
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-01-15T10:00:00Z",
    };

    it("carries the invitee address for its creator", () => {
      expect(zInvitation.parse(invitation).email).toBe("invitee@example.com");
    });

    it("accepts a withheld address", () => {
      expect(zInvitation.parse({ ...invitation, email: null }).email).toBeNull();
    });
  });
});
