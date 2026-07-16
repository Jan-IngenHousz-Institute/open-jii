import { describe, it, expect } from "vitest";

import {
  ExperimentColumnPrimitiveType,
  WellKnownColumnTypes,
} from "../domains/experiment/data/experiment-data.schema";
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
  getColumnKind,
  isPlottableColumn,
  isCategoricalColumnType,
} from "./column-type-utils";

describe("column-type-utils", () => {
  describe("isNumericType", () => {
    it("should return true for integer types", () => {
      expect(isNumericType(ExperimentColumnPrimitiveType.TINYINT)).toBe(true);
      expect(isNumericType(ExperimentColumnPrimitiveType.SMALLINT)).toBe(true);
      expect(isNumericType(ExperimentColumnPrimitiveType.INT)).toBe(true);
      expect(isNumericType(ExperimentColumnPrimitiveType.BIGINT)).toBe(true);
      expect(isNumericType(ExperimentColumnPrimitiveType.LONG)).toBe(true);
    });

    it("should return true for floating point types", () => {
      expect(isNumericType(ExperimentColumnPrimitiveType.FLOAT)).toBe(true);
      expect(isNumericType(ExperimentColumnPrimitiveType.DOUBLE)).toBe(true);
      expect(isNumericType(ExperimentColumnPrimitiveType.REAL)).toBe(true);
    });

    it("should return true for decimal types", () => {
      expect(isNumericType("DECIMAL")).toBe(true);
      expect(isNumericType("DECIMAL(10,2)")).toBe(true);
      expect(isNumericType("NUMERIC")).toBe(true);
      expect(isNumericType("NUMERIC(18,6)")).toBe(true);
    });

    it("should return false for non-numeric types", () => {
      expect(isNumericType(ExperimentColumnPrimitiveType.STRING)).toBe(false);
      expect(isNumericType(ExperimentColumnPrimitiveType.BOOLEAN)).toBe(false);
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
      expect(isVariantType(ExperimentColumnPrimitiveType.VARIANT)).toBe(true);
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
      expect(isSortableType(ExperimentColumnPrimitiveType.INT)).toBe(true);
      expect(isSortableType(ExperimentColumnPrimitiveType.STRING)).toBe(true);
      expect(isSortableType(ExperimentColumnPrimitiveType.TIMESTAMP)).toBe(true);
      expect(isSortableType(ExperimentColumnPrimitiveType.BOOLEAN)).toBe(true);
    });

    it("should return false for complex types", () => {
      expect(isSortableType("ARRAY<INT>")).toBe(false);
      expect(isSortableType("MAP<STRING,INT>")).toBe(false);
      expect(isSortableType("STRUCT<x:INT>")).toBe(false);
      expect(isSortableType(ExperimentColumnPrimitiveType.VARIANT)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isSortableType(undefined)).toBe(false);
    });
  });

  describe("isTimestampType", () => {
    it("should return true for timestamp types", () => {
      expect(isTimestampType(ExperimentColumnPrimitiveType.TIMESTAMP)).toBe(true);
      expect(isTimestampType(ExperimentColumnPrimitiveType.TIMESTAMP_NTZ)).toBe(true);
    });

    it("should return false for non-timestamp types", () => {
      expect(isTimestampType("INT")).toBe(false);
      expect(isTimestampType("STRING")).toBe(false);
      expect(isTimestampType(undefined)).toBe(false);
    });
  });

  describe("isStringType", () => {
    it("should return true for string types", () => {
      expect(isStringType(ExperimentColumnPrimitiveType.STRING)).toBe(true);
      expect(isStringType(ExperimentColumnPrimitiveType.VARCHAR)).toBe(true);
      expect(isStringType(ExperimentColumnPrimitiveType.CHAR)).toBe(true);
    });

    it("should return false for non-string types", () => {
      expect(isStringType("INT")).toBe(false);
      expect(isStringType("BOOLEAN")).toBe(false);
      expect(isStringType(undefined)).toBe(false);
    });
  });

  describe("isDecimalType", () => {
    it("should return true for decimal types", () => {
      expect(isDecimalType(ExperimentColumnPrimitiveType.DECIMAL)).toBe(true);
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
    });

    it("should return false for non-well-known types", () => {
      expect(isWellKnownType("INT")).toBe(false);
      expect(isWellKnownType("STRING")).toBe(false);
      expect(isWellKnownType(undefined)).toBe(false);
    });
  });

  describe("isWellKnownSortableType", () => {
    it("should return true for CONTRIBUTOR and DEVICE types", () => {
      expect(isWellKnownSortableType(WellKnownColumnTypes.CONTRIBUTOR)).toBe(true);
      expect(isWellKnownSortableType(WellKnownColumnTypes.DEVICE)).toBe(true);
    });

    it("should return false for non-sortable well-known types", () => {
      expect(isWellKnownSortableType(WellKnownColumnTypes.ANNOTATIONS)).toBe(false);
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

    it("should return 'serial_number' for DEVICE type", () => {
      expect(getWellKnownSortField(WellKnownColumnTypes.DEVICE)).toBe("serial_number");
    });

    it("should return undefined for non-sortable well-known types", () => {
      expect(getWellKnownSortField(WellKnownColumnTypes.ANNOTATIONS)).toBeUndefined();
    });

    it("should return undefined for other types", () => {
      expect(getWellKnownSortField("INT")).toBeUndefined();
      expect(getWellKnownSortField("STRING")).toBeUndefined();
      expect(getWellKnownSortField(undefined)).toBeUndefined();
    });
  });

  describe("isValidAxisSource (alias for isPlottableColumn)", () => {
    it("accepts numeric types", () => {
      expect(isValidAxisSource(ExperimentColumnPrimitiveType.INT)).toBe(true);
      expect(isValidAxisSource(ExperimentColumnPrimitiveType.FLOAT)).toBe(true);
      expect(isValidAxisSource(ExperimentColumnPrimitiveType.DOUBLE)).toBe(true);
    });

    it("accepts temporal types", () => {
      expect(isValidAxisSource(ExperimentColumnPrimitiveType.TIMESTAMP)).toBe(true);
      expect(isValidAxisSource(ExperimentColumnPrimitiveType.TIMESTAMP_NTZ)).toBe(true);
      expect(isValidAxisSource("DATE")).toBe(true);
    });

    it("accepts categorical types — Plotly auto-creates a category axis", () => {
      // Strings often store numeric data too (e.g. soil_moisture: "5.3");
      // surfacing them in axis pickers lets the renderer's smart cell
      // coercion handle the rest.
      expect(isValidAxisSource("STRING")).toBe(true);
      expect(isValidAxisSource("BOOLEAN")).toBe(true);
    });

    it("rejects complex types and unknown inputs", () => {
      expect(isValidAxisSource("ARRAY<INT>")).toBe(false);
      expect(isValidAxisSource("STRUCT<a: INT>")).toBe(false);
      expect(isValidAxisSource("MAP<STRING, INT>")).toBe(false);
      expect(isValidAxisSource("VARIANT")).toBe(false);
      expect(isValidAxisSource(undefined)).toBe(false);
    });

    it("accepts well-known sortable structs (CONTRIBUTOR) as categorical", () => {
      // Underlying type is STRUCT but the column is plottable via its
      // sort field (`name`). Drives the per-participant viz feature.
      expect(isValidAxisSource(WellKnownColumnTypes.CONTRIBUTOR)).toBe(true);
    });

    it("still rejects non-sortable well-known structs", () => {
      expect(isValidAxisSource(WellKnownColumnTypes.ANNOTATIONS)).toBe(false);
    });
  });

  describe("getColumnKind", () => {
    it("maps numeric and decimal types to 'numeric'", () => {
      expect(getColumnKind(ExperimentColumnPrimitiveType.INT)).toBe("numeric");
      expect(getColumnKind(ExperimentColumnPrimitiveType.DOUBLE)).toBe("numeric");
      expect(getColumnKind("DECIMAL(10,2)")).toBe("numeric");
      expect(getColumnKind("NUMERIC")).toBe("numeric");
    });

    it("maps timestamp and DATE to 'temporal'", () => {
      expect(getColumnKind(ExperimentColumnPrimitiveType.TIMESTAMP)).toBe("temporal");
      expect(getColumnKind(ExperimentColumnPrimitiveType.TIMESTAMP_NTZ)).toBe("temporal");
      expect(getColumnKind("DATE")).toBe("temporal");
    });

    it("maps strings and booleans to 'categorical'", () => {
      expect(getColumnKind(ExperimentColumnPrimitiveType.STRING)).toBe("categorical");
      expect(getColumnKind(ExperimentColumnPrimitiveType.VARCHAR)).toBe("categorical");
      expect(getColumnKind(ExperimentColumnPrimitiveType.BOOLEAN)).toBe("categorical");
    });

    it("short-circuits CONTRIBUTOR to 'categorical' before the complex branch", () => {
      // Underlying type is STRUCT<...> but the well-known table maps it to a
      // categorical kind via the `name` sort field. Guards against regressing
      // the well-known-sortable short-circuit.
      expect(getColumnKind(WellKnownColumnTypes.CONTRIBUTOR)).toBe("categorical");
    });

    it("maps unsortable well-known structs and other complex types to 'complex'", () => {
      expect(getColumnKind(WellKnownColumnTypes.ANNOTATIONS)).toBe("complex");
      expect(getColumnKind("ARRAY<INT>")).toBe("complex");
      expect(getColumnKind("MAP<STRING, INT>")).toBe("complex");
      expect(getColumnKind("STRUCT<a: INT>")).toBe("complex");
      expect(getColumnKind(ExperimentColumnPrimitiveType.VARIANT)).toBe("complex");
    });

    it("returns undefined for unknown or missing input", () => {
      expect(getColumnKind(undefined)).toBeUndefined();
      expect(getColumnKind("GEOGRAPHY")).toBeUndefined();
    });
  });

  describe("isPlottableColumn", () => {
    it("accepts every non-complex kind", () => {
      expect(isPlottableColumn(ExperimentColumnPrimitiveType.INT)).toBe(true);
      expect(isPlottableColumn("DATE")).toBe(true);
      expect(isPlottableColumn(ExperimentColumnPrimitiveType.STRING)).toBe(true);
    });

    it("rejects complex and unknown columns", () => {
      expect(isPlottableColumn("ARRAY<INT>")).toBe(false);
      expect(isPlottableColumn(WellKnownColumnTypes.ANNOTATIONS)).toBe(false);
      expect(isPlottableColumn(undefined)).toBe(false);
    });
  });

  describe("isCategoricalColumnType", () => {
    it("treats strings, booleans, and CONTRIBUTOR as categorical", () => {
      expect(isCategoricalColumnType(ExperimentColumnPrimitiveType.STRING)).toBe(true);
      expect(isCategoricalColumnType(ExperimentColumnPrimitiveType.BOOLEAN)).toBe(true);
      expect(isCategoricalColumnType(WellKnownColumnTypes.CONTRIBUTOR)).toBe(true);
    });

    it("rejects numeric and temporal kinds (continuous by default)", () => {
      expect(isCategoricalColumnType(ExperimentColumnPrimitiveType.INT)).toBe(false);
      expect(isCategoricalColumnType(ExperimentColumnPrimitiveType.TIMESTAMP)).toBe(false);
      expect(isCategoricalColumnType("DATE")).toBe(false);
    });

    it("rejects complex and unknown types", () => {
      expect(isCategoricalColumnType("ARRAY<INT>")).toBe(false);
      expect(isCategoricalColumnType(undefined)).toBe(false);
    });
  });
});
