import { formatDates, formatDatesList } from "./date-formatter";

describe("Date Formatter", () => {
  // Set up some mock dates for testing
  const mockDate1 = new Date("2023-01-15T12:30:45.123Z");
  const mockDate2 = new Date("2023-02-20T18:15:30.456Z");

  describe("formatDates", () => {
    it("should format Date objects to ISO strings", () => {
      // Arrange
      const entity = {
        id: "123",
        name: "Test Entity",
        createdAt: mockDate1,
        updatedAt: mockDate2,
      };

      // Act
      const result = formatDates(entity);

      // Assert
      expect(result).toEqual({
        id: "123",
        name: "Test Entity",
        createdAt: mockDate1.toISOString(),
        updatedAt: mockDate2.toISOString(),
      });
    });

    it("should handle nested objects with dates", () => {
      // Arrange
      const entity = {
        id: "123",
        name: "Test Entity",
        createdAt: mockDate1,
        metadata: {
          lastModified: mockDate2,
          description: "Some description",
        },
      };

      // Act
      const result = formatDates(entity);

      // Assert
      expect(result).toEqual({
        id: "123",
        name: "Test Entity",
        createdAt: mockDate1.toISOString(),
        metadata: {
          lastModified: mockDate2.toISOString(),
          description: "Some description",
        },
      });
    });

    it("should handle arrays of objects with dates", () => {
      // Arrange
      const entity = {
        id: "123",
        name: "Test Entity",
        history: [
          { timestamp: mockDate1, action: "created" },
          { timestamp: mockDate2, action: "updated" },
        ],
      };

      // Act
      const result = formatDates(entity);

      // Assert
      expect(result).toEqual({
        id: "123",
        name: "Test Entity",
        history: [
          { timestamp: mockDate1.toISOString(), action: "created" },
          { timestamp: mockDate2.toISOString(), action: "updated" },
        ],
      });
    });

    it("should handle deeply nested structures with dates", () => {
      // Arrange
      const entity = {
        id: "123",
        createdAt: mockDate1,
        details: {
          metadata: {
            lastCheck: mockDate2,
            records: [
              { timestamp: mockDate1, value: 10 },
              { timestamp: mockDate2, value: 20 },
            ],
          },
        },
      };

      // Act
      const result = formatDates(entity);

      // Assert
      expect(result).toEqual({
        id: "123",
        createdAt: mockDate1.toISOString(),
        details: {
          metadata: {
            lastCheck: mockDate2.toISOString(),
            records: [
              { timestamp: mockDate1.toISOString(), value: 10 },
              { timestamp: mockDate2.toISOString(), value: 20 },
            ],
          },
        },
      });
    });

    it("should handle non-date objects", () => {
      // Arrange
      const entity = {
        id: "123",
        name: "Test Entity",
        count: 42,
        active: true,
        tags: ["tag1", "tag2"],
      };

      // Act
      const result = formatDates(entity);

      // Assert
      expect(result).toEqual(entity); // Should return the same object unchanged
    });

    it("should handle null and undefined values", () => {
      // Arrange
      const entity = {
        id: "123",
        createdAt: mockDate1,
        updatedAt: null,
        deletedAt: undefined,
        metadata: null,
      };

      // Act
      const result = formatDates(entity);

      // Assert
      expect(result).toEqual({
        id: "123",
        createdAt: mockDate1.toISOString(),
        updatedAt: null,
        deletedAt: undefined,
        metadata: null,
      });
    });

    it("should return primitives as is", () => {
      // We need to cast primitives to any to bypass the type check since the function
      // actually handles primitives correctly at runtime by returning them as-is
      expect(formatDates("string" as any)).toBe("string");
      expect(formatDates(123 as any)).toBe(123);
      expect(formatDates(true as any)).toBe(true);
      expect(formatDates(null as any)).toBe(null);
      expect(formatDates(undefined as any)).toBe(undefined);
    });
  });

  describe("formatDatesList", () => {
    it("should format dates in an array of objects", () => {
      // Arrange
      const entities = [
        {
          id: "1",
          name: "Entity 1",
          createdAt: mockDate1,
          updatedAt: mockDate2,
        },
        {
          id: "2",
          name: "Entity 2",
          createdAt: mockDate2,
          updatedAt: mockDate1,
        },
      ];

      // Act
      const result = formatDatesList(entities);

      // Assert
      expect(result).toEqual([
        {
          id: "1",
          name: "Entity 1",
          createdAt: mockDate1.toISOString(),
          updatedAt: mockDate2.toISOString(),
        },
        {
          id: "2",
          name: "Entity 2",
          createdAt: mockDate2.toISOString(),
          updatedAt: mockDate1.toISOString(),
        },
      ]);
    });

    it("should handle empty arrays", () => {
      expect(formatDatesList([])).toEqual([]);
    });

    it("should handle complex arrays with nested dates", () => {
      // Arrange
      const entities = [
        {
          id: "1",
          createdAt: mockDate1,
          metadata: { lastUpdated: mockDate2 },
        },
        {
          id: "2",
          createdAt: mockDate2,
          metadata: { lastUpdated: mockDate1 },
        },
      ];

      // Act
      const result = formatDatesList(entities);

      // Assert
      expect(result).toEqual([
        {
          id: "1",
          createdAt: mockDate1.toISOString(),
          metadata: { lastUpdated: mockDate2.toISOString() },
        },
        {
          id: "2",
          createdAt: mockDate2.toISOString(),
          metadata: { lastUpdated: mockDate1.toISOString() },
        },
      ]);
    });
  });
});
