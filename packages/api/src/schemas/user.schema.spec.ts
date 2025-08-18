import { describe, it, expect } from "vitest";

import {
  zUser,
  zUserList,
  zSearchUsersQuery,
  zCreateUserProfileBody,
  zUserIdPathParam,
} from "./user.schema";

describe("User Schema", () => {
  describe("zUser", () => {
    it("should validate a valid user object", () => {
      const validUser = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "John Doe",
        email: "john.doe@example.com",
        emailVerified: "2024-01-15T10:30:00Z",
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
        emailVerified: null,
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
        emailVerified: null,
        image: null,
        createdAt: "2024-01-15T10:00:00Z",
        registered: true,
      };

      expect(() => zUser.parse(invalidUser)).toThrow();
    });

    it("should reject invalid email format", () => {
      const invalidUser = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "John Doe",
        email: "invalid-email",
        emailVerified: null,
        image: null,
        createdAt: "2024-01-15T10:00:00Z",
        registered: true,
      };

      expect(() => zUser.parse(invalidUser)).toThrow();
    });
  });

  describe("zUserList", () => {
    it("should validate an array of users", () => {
      const userList = [
        {
          id: "123e4567-e89b-12d3-a456-426614174000",
          name: "John Doe",
          email: "john.doe@example.com",
          emailVerified: null,
          image: null,
          createdAt: "2024-01-15T10:00:00Z",
          registered: true,
        },
        {
          id: "456e7890-e12b-34d5-a789-123456789000",
          name: "Jane Smith",
          email: "jane.smith@example.com",
          emailVerified: null,
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
        limit: 25,
        offset: 10,
      };

      const result = zSearchUsersQuery.parse(query);
      expect(result).toEqual(query);
    });

    it("should apply default values when fields are undefined", () => {
      const query = {};
      const result = zSearchUsersQuery.parse(query);

      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it("should handle empty object gracefully", () => {
      const query = {};
      const result = zSearchUsersQuery.parse(query);

      // Empty object should parse successfully, but optional fields may be undefined
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });

    it("should coerce string numbers", () => {
      const query = {
        limit: "10",
        offset: "5",
      };

      const result = zSearchUsersQuery.parse(query);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(5);
    });

    it("should reject limit above maximum", () => {
      const query = { limit: 150 };
      expect(() => zSearchUsersQuery.parse(query)).toThrow();
    });

    it("should reject negative offset", () => {
      const query = { offset: -1 };
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

    it("should validate with optional organization", () => {
      const profile = {
        firstName: "John",
        lastName: "Doe",
        organization: "ACME Corp",
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
});
