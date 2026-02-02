import { describe, it, expect } from "vitest";

import { ColumnPrimitiveType, WellKnownColumnTypes } from "../schemas/experiment.schema";
import {
  isNumericType,
  isArrayType,
  isMapType,
  isStructType,
  isVariantType,
  isStructArrayType,
  isNumericArrayType,
  isSortableType,
  isTimestampType,
  isStringType,
  isDecimalType,
  isWellKnownType,
  isWellKnownSortableType,
  getWellKnownSortField,
  isValidAxisSource,
} from "./column-type-utils";

describe("column-type-utils", () => {
  describe("isNumericType", () => {
    it("should return true for integer types", () => {
      expect(isNumericType(ColumnPrimitiveType.TINYINT)).toBe(true);
      expect(isNumericType(ColumnPrimitiveType.SMALLINT)).toBe(true);
      expect(isNumericType(ColumnPrimitiveType.INT)).toBe(true);
      expect(isNumericType(ColumnPrimitiveType.BIGINT)).toBe(true);
      expect(isNumericType(ColumnPrimitiveType.LONG)).toBe(true);
    });

    it("should return true for floating point types", () => {
      expect(isNumericType(ColumnPrimitiveType.FLOAT)).toBe(true);
      expect(isNumericType(ColumnPrimitiveType.DOUBLE)).toBe(true);
      expect(isNumericType(ColumnPrimitiveType.REAL)).toBe(true);
    });

    it("should return true for decimal types", () => {
      expect(isNumericType("DECIMAL")).toBe(true);
      expect(isNumericType("DECIMAL(10,2)")).toBe(true);
      expect(isNumericType("NUMERIC")).toBe(true);
      expect(isNumericType("NUMERIC(18,6)")).toBe(true);
    });

    it("should return false for non-numeric types", () => {
      expect(isNumericType(ColumnPrimitiveType.STRING)).toBe(false);
      expect(isNumericType(ColumnPrimitiveType.BOOLEAN)).toBe(false);
      expect(isNumericType(undefined)).toBe(false);
    });
  });

  describe("isArrayType", () => {
    it("should return true for array types", () => {
      expect(isArrayType("ARRAY<INT>")).toBe(true);
      expect(isArrayType("ARRAY<STRING>")).toBe(true);
      expect(isArrayType("ARRAY<STRUCT<x:INT,y:INT>>")).toBe(true);
    });

    it("should return false for non-array types", () => {
      expect(isArrayType("INT")).toBe(false);
      expect(isArrayType("STRING")).toBe(false);
      expect(isArrayType(undefined)).toBe(false);
    });
  });

  describe("isMapType", () => {
    it("should return true for map types", () => {
      expect(isMapType("MAP<STRING,INT>")).toBe(true);
      expect(isMapType("MAP<INT,STRING>")).toBe(true);
    });

    it("should return false for non-map types", () => {
      expect(isMapType("INT")).toBe(false);
      expect(isMapType("ARRAY<INT>")).toBe(false);
      expect(isMapType(undefined)).toBe(false);
    });
  });

  describe("isStructType", () => {
    it("should return true for struct types", () => {
      expect(isStructType("STRUCT<field1:STRING,field2:INT>")).toBe(true);
      expect(isStructType("STRUCT<x:INT>")).toBe(true);
    });

    it("should return false for non-struct types", () => {
      expect(isStructType("INT")).toBe(false);
      expect(isStructType("ARRAY<INT>")).toBe(false);
      expect(isStructType(undefined)).toBe(false);
    });
  });

  describe("isVariantType", () => {
    it("should return true for variant type", () => {
      expect(isVariantType(ColumnPrimitiveType.VARIANT)).toBe(true);
    });

    it("should return false for non-variant types", () => {
      expect(isVariantType("INT")).toBe(false);
      expect(isVariantType("STRING")).toBe(false);
      expect(isVariantType(undefined)).toBe(false);
    });
  });

  describe("isStructArrayType", () => {
    it("should return true for array of struct types", () => {
      expect(isStructArrayType("ARRAY<STRUCT<x:INT,y:INT>>")).toBe(true);
      expect(isStructArrayType("ARRAY<STRUCT<field:STRING>>")).toBe(true);
    });

    it("should return false for non-struct-array types", () => {
      expect(isStructArrayType("ARRAY<INT>")).toBe(false);
      expect(isStructArrayType("STRUCT<x:INT>")).toBe(false);
      expect(isStructArrayType("INT")).toBe(false);
      expect(isStructArrayType(undefined)).toBe(false);
    });
  });

  describe("isNumericArrayType", () => {
    it("should return true for arrays of numeric types", () => {
      expect(isNumericArrayType("ARRAY<INT>")).toBe(true);
      expect(isNumericArrayType("ARRAY<BIGINT>")).toBe(true);
      expect(isNumericArrayType("ARRAY<FLOAT>")).toBe(true);
      expect(isNumericArrayType("ARRAY<DOUBLE>")).toBe(true);
      expect(isNumericArrayType("ARRAY<DECIMAL>")).toBe(true);
    });

    it("should return false for non-numeric-array types", () => {
      expect(isNumericArrayType("ARRAY<STRING>")).toBe(false);
      expect(isNumericArrayType("INT")).toBe(false);
      expect(isNumericArrayType(undefined)).toBe(false);
    });
  });

  describe("isSortableType", () => {
    it("should return true for primitive types", () => {
      expect(isSortableType(ColumnPrimitiveType.INT)).toBe(true);
      expect(isSortableType(ColumnPrimitiveType.STRING)).toBe(true);
      expect(isSortableType(ColumnPrimitiveType.TIMESTAMP)).toBe(true);
      expect(isSortableType(ColumnPrimitiveType.BOOLEAN)).toBe(true);
    });

    it("should return false for complex types", () => {
      expect(isSortableType("ARRAY<INT>")).toBe(false);
      expect(isSortableType("MAP<STRING,INT>")).toBe(false);
      expect(isSortableType("STRUCT<x:INT>")).toBe(false);
      expect(isSortableType(ColumnPrimitiveType.VARIANT)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isSortableType(undefined)).toBe(false);
    });
  });

  describe("isTimestampType", () => {
    it("should return true for timestamp types", () => {
      expect(isTimestampType(ColumnPrimitiveType.TIMESTAMP)).toBe(true);
      expect(isTimestampType(ColumnPrimitiveType.TIMESTAMP_NTZ)).toBe(true);
    });

    it("should return false for non-timestamp types", () => {
      expect(isTimestampType("INT")).toBe(false);
      expect(isTimestampType("STRING")).toBe(false);
      expect(isTimestampType(undefined)).toBe(false);
    });
  });

  describe("isStringType", () => {
    it("should return true for string types", () => {
      expect(isStringType(ColumnPrimitiveType.STRING)).toBe(true);
      expect(isStringType(ColumnPrimitiveType.VARCHAR)).toBe(true);
      expect(isStringType(ColumnPrimitiveType.CHAR)).toBe(true);
    });

    it("should return false for non-string types", () => {
      expect(isStringType("INT")).toBe(false);
      expect(isStringType("BOOLEAN")).toBe(false);
      expect(isStringType(undefined)).toBe(false);
    });
  });

  describe("isDecimalType", () => {
    it("should return true for decimal types", () => {
      expect(isDecimalType(ColumnPrimitiveType.DECIMAL)).toBe(true);
      expect(isDecimalType("DECIMAL(10,2)")).toBe(true);
      expect(isDecimalType("DECIMAL(18,6)")).toBe(true);
    });

    it("should return false for non-decimal types", () => {
      expect(isDecimalType("INT")).toBe(false);
      expect(isDecimalType("FLOAT")).toBe(false);
      expect(isDecimalType(undefined)).toBe(false);
    });
  });

  describe("isWellKnownType", () => {
    it("should return true for well-known types", () => {
      expect(isWellKnownType(WellKnownColumnTypes.CONTRIBUTOR)).toBe(true);
      expect(isWellKnownType(WellKnownColumnTypes.ANNOTATIONS)).toBe(true);
      expect(isWellKnownType(WellKnownColumnTypes.QUESTIONS)).toBe(true);
    });

    it("should return false for non-well-known types", () => {
      expect(isWellKnownType("INT")).toBe(false);
      expect(isWellKnownType("STRING")).toBe(false);
      expect(isWellKnownType(undefined)).toBe(false);
    });
  });

  describe("isWellKnownSortableType", () => {
    it("should return true only for CONTRIBUTOR type", () => {
      expect(isWellKnownSortableType(WellKnownColumnTypes.CONTRIBUTOR)).toBe(true);
    });

    it("should return false for non-sortable well-known types", () => {
      expect(isWellKnownSortableType(WellKnownColumnTypes.ANNOTATIONS)).toBe(false);
      expect(isWellKnownSortableType(WellKnownColumnTypes.QUESTIONS)).toBe(false);
    });

    it("should return false for other types", () => {
      expect(isWellKnownSortableType("INT")).toBe(false);
      expect(isWellKnownSortableType("STRING")).toBe(false);
      expect(isWellKnownSortableType(undefined)).toBe(false);
    });
  });

  describe("getWellKnownSortField", () => {
    it("should return 'name' for CONTRIBUTOR type", () => {
      expect(getWellKnownSortField(WellKnownColumnTypes.CONTRIBUTOR)).toBe("name");
    });

    it("should return undefined for non-sortable well-known types", () => {
      expect(getWellKnownSortField(WellKnownColumnTypes.ANNOTATIONS)).toBeUndefined();
      expect(getWellKnownSortField(WellKnownColumnTypes.QUESTIONS)).toBeUndefined();
    });

    it("should return undefined for other types", () => {
      expect(getWellKnownSortField("INT")).toBeUndefined();
      expect(getWellKnownSortField("STRING")).toBeUndefined();
      expect(getWellKnownSortField(undefined)).toBeUndefined();
    });
  });

  describe("isValidAxisSource", () => {
    it("should return true for numeric types", () => {
      expect(isValidAxisSource(ColumnPrimitiveType.INT)).toBe(true);
      expect(isValidAxisSource(ColumnPrimitiveType.FLOAT)).toBe(true);
      expect(isValidAxisSource(ColumnPrimitiveType.DOUBLE)).toBe(true);
    });

    it("should return true for timestamp types", () => {
      expect(isValidAxisSource(ColumnPrimitiveType.TIMESTAMP)).toBe(true);
      expect(isValidAxisSource(ColumnPrimitiveType.TIMESTAMP_NTZ)).toBe(true);
    });

    it("should return false for non-numeric and non-timestamp types", () => {
      expect(isValidAxisSource("STRING")).toBe(false);
      expect(isValidAxisSource("BOOLEAN")).toBe(false);
      expect(isValidAxisSource("ARRAY<INT>")).toBe(false);
      expect(isValidAxisSource(undefined)).toBe(false);
    });
  });
});
