import type { SchemaData } from "../../../../common/modules/databricks/services/sql/sql.types";
import { DataEnrichmentService } from "./data-enrichment.service";
import type { SchemaDataDto } from "./data-enrichment.service";

// Concrete implementation of DataEnrichmentService for testing
class TestDataEnrichmentService extends DataEnrichmentService {
  private sourceColumns: string[];
  private targetColumn: string;
  private targetType: string;

  constructor(sourceColumns: string[], targetColumn: string, targetType: string) {
    super();
    this.sourceColumns = sourceColumns;
    this.targetColumn = targetColumn;
    this.targetType = targetType;
  }

  getSourceColumns(): string[] {
    return this.sourceColumns;
  }

  getTargetColumn(): string {
    return this.targetColumn;
  }

  getTargetType(): string {
    return this.targetType;
  }

  canEnrich(schemaData: SchemaData): boolean {
    // Check if all source columns exist in the schema
    const columnNames = schemaData.columns.map((col) => col.name);
    return this.sourceColumns.every((sourceCol) => columnNames.includes(sourceCol));
  }

  enrichData(schemaData: SchemaData): Promise<SchemaDataDto> {
    // For testing, we'll add a new column that concatenates the source columns
    const newColumns = [
      ...schemaData.columns,
      {
        name: this.targetColumn,
        type_name: this.targetType,
        type_text: this.targetType,
      },
    ];

    const enrichedRows = schemaData.rows.map((row) => {
      // Get values from source columns
      const sourceValues = this.sourceColumns.map((sourceCol) => {
        const colIndex = schemaData.columns.findIndex((col) => col.name === sourceCol);
        return colIndex >= 0 ? row[colIndex] : null;
      });

      // Create enriched value (concatenate non-null source values)
      const enrichedValue = sourceValues.filter((val) => val !== null).join(" ");

      return [...row, enrichedValue || null];
    });

    return Promise.resolve(this.convertToDto(newColumns, enrichedRows, schemaData));
  }

  // Make convertToDto public for testing
  public testConvertToDto(
    columns: SchemaDataDto["columns"],
    rows: (string | null)[][],
    schemaData: SchemaData,
  ): SchemaDataDto {
    return this.convertToDto(columns, rows, schemaData);
  }
}

describe("DataEnrichmentService", () => {
  let service: TestDataEnrichmentService;

  beforeEach(() => {
    service = new TestDataEnrichmentService(["first_name", "last_name"], "full_name", "STRING");
  });

  describe("getSourceColumns", () => {
    it("should return the configured source columns", () => {
      expect(service.getSourceColumns()).toEqual(["first_name", "last_name"]);
    });
  });

  describe("getTargetColumn", () => {
    it("should return the configured target column", () => {
      expect(service.getTargetColumn()).toBe("full_name");
    });
  });

  describe("getTargetType", () => {
    it("should return the configured target type", () => {
      expect(service.getTargetType()).toBe("STRING");
    });
  });

  describe("canEnrich", () => {
    it("should return true when all source columns exist in schema", () => {
      const schemaData: SchemaData = {
        columns: [
          { name: "first_name", type_name: "STRING", type_text: "STRING" },
          { name: "last_name", type_name: "STRING", type_text: "STRING" },
          { name: "age", type_name: "INTEGER", type_text: "INTEGER" },
        ],
        rows: [
          ["John", "Doe", "30"],
          ["Jane", "Smith", "25"],
        ],
        totalRows: 2,
        truncated: false,
      };

      expect(service.canEnrich(schemaData)).toBe(true);
    });

    it("should return false when some source columns are missing from schema", () => {
      const schemaData: SchemaData = {
        columns: [
          { name: "first_name", type_name: "STRING", type_text: "STRING" },
          { name: "age", type_name: "INTEGER", type_text: "INTEGER" },
        ],
        rows: [
          ["John", "30"],
          ["Jane", "25"],
        ],
        totalRows: 2,
        truncated: false,
      };

      expect(service.canEnrich(schemaData)).toBe(false);
    });

    it("should return false when no source columns exist in schema", () => {
      const schemaData: SchemaData = {
        columns: [
          { name: "age", type_name: "INTEGER", type_text: "INTEGER" },
          { name: "city", type_name: "STRING", type_text: "STRING" },
        ],
        rows: [
          ["30", "New York"],
          ["25", "Boston"],
        ],
        totalRows: 2,
        truncated: false,
      };

      expect(service.canEnrich(schemaData)).toBe(false);
    });
  });

  describe("enrichData", () => {
    it("should enrich data by adding a new column with concatenated values", async () => {
      const schemaData: SchemaData = {
        columns: [
          { name: "first_name", type_name: "STRING", type_text: "STRING" },
          { name: "last_name", type_name: "STRING", type_text: "STRING" },
          { name: "age", type_name: "INTEGER", type_text: "INTEGER" },
        ],
        rows: [
          ["John", "Doe", "30"],
          ["Jane", "Smith", "25"],
        ],
        totalRows: 2,
        truncated: false,
      };

      const result = await service.enrichData(schemaData);

      expect(result).toEqual({
        columns: [
          { name: "first_name", type_name: "STRING", type_text: "STRING" },
          { name: "last_name", type_name: "STRING", type_text: "STRING" },
          { name: "age", type_name: "INTEGER", type_text: "INTEGER" },
          { name: "full_name", type_name: "STRING", type_text: "STRING" },
        ],
        rows: [
          {
            first_name: "John",
            last_name: "Doe",
            age: "30",
            full_name: "John Doe",
          },
          {
            first_name: "Jane",
            last_name: "Smith",
            age: "25",
            full_name: "Jane Smith",
          },
        ],
        totalRows: 2,
        truncated: false,
      });
    });

    it("should handle null values in source columns", async () => {
      const schemaData: SchemaData = {
        columns: [
          { name: "first_name", type_name: "STRING", type_text: "STRING" },
          { name: "last_name", type_name: "STRING", type_text: "STRING" },
        ],
        rows: [
          ["John", null],
          [null, "Smith"],
          [null, null],
        ],
        totalRows: 3,
        truncated: false,
      };

      const result = await service.enrichData(schemaData);

      expect(result.rows).toEqual([
        {
          first_name: "John",
          last_name: null,
          full_name: "John",
        },
        {
          first_name: null,
          last_name: "Smith",
          full_name: "Smith",
        },
        {
          first_name: null,
          last_name: null,
          full_name: null,
        },
      ]);
    });

    it("should preserve original schema metadata", async () => {
      const schemaData: SchemaData = {
        columns: [
          { name: "first_name", type_name: "STRING", type_text: "STRING" },
          { name: "last_name", type_name: "STRING", type_text: "STRING" },
        ],
        rows: [["John", "Doe"]],
        totalRows: 100,
        truncated: true,
      };

      const result = await service.enrichData(schemaData);

      expect(result.totalRows).toBe(100);
      expect(result.truncated).toBe(true);
    });
  });

  describe("convertToDto", () => {
    it("should convert raw data to DTO format correctly", () => {
      const columns = [
        { name: "name", type_name: "STRING", type_text: "STRING" },
        { name: "age", type_name: "INTEGER", type_text: "INTEGER" },
      ];
      const rows = [
        ["John", "30"],
        ["Jane", "25"],
      ];
      const schemaData: SchemaData = {
        columns,
        rows,
        totalRows: 2,
        truncated: false,
      };

      const result = service["convertToDto"](columns, rows, schemaData);

      expect(result).toEqual({
        columns,
        rows: [
          { name: "John", age: "30" },
          { name: "Jane", age: "25" },
        ],
        totalRows: 2,
        truncated: false,
      });
    });

    it("should handle empty rows", () => {
      const columns = [
        { name: "name", type_name: "STRING", type_text: "STRING" },
        { name: "age", type_name: "INTEGER", type_text: "INTEGER" },
      ];
      const rows: (string | null)[][] = [];
      const schemaData: SchemaData = {
        columns,
        rows,
        totalRows: 0,
        truncated: false,
      };

      const result = service["convertToDto"](columns, rows, schemaData);

      expect(result).toEqual({
        columns,
        rows: [],
        totalRows: 0,
        truncated: false,
      });
    });

    it("should handle rows with fewer values than columns", () => {
      const columns = [
        { name: "name", type_name: "STRING", type_text: "STRING" },
        { name: "age", type_name: "INTEGER", type_text: "INTEGER" },
        { name: "city", type_name: "STRING", type_text: "STRING" },
      ];
      const rows = [
        ["John", "30"], // Missing city
        ["Jane"], // Missing age and city
      ];
      const schemaData: SchemaData = {
        columns,
        rows,
        totalRows: 2,
        truncated: false,
      };

      const result = service.testConvertToDto(columns, rows, schemaData);

      expect(result.rows).toEqual([{ name: "John", age: "30" }, { name: "Jane" }]);
    });

    it("should handle null values correctly", () => {
      const columns = [
        { name: "name", type_name: "STRING", type_text: "STRING" },
        { name: "age", type_name: "INTEGER", type_text: "INTEGER" },
      ];
      const rows = [
        ["John", null],
        [null, "30"],
      ];
      const schemaData: SchemaData = {
        columns,
        rows,
        totalRows: 2,
        truncated: false,
      };

      const result = service["convertToDto"](columns, rows, schemaData);

      expect(result.rows).toEqual([
        { name: "John", age: null },
        { name: null, age: "30" },
      ]);
    });
  });

  describe("different enrichment configurations", () => {
    it("should work with single source column", () => {
      const singleColumnService = new TestDataEnrichmentService(["email"], "domain", "STRING");

      expect(singleColumnService.getSourceColumns()).toEqual(["email"]);
      expect(singleColumnService.getTargetColumn()).toBe("domain");
    });

    it("should work with multiple source columns", () => {
      const multiColumnService = new TestDataEnrichmentService(
        ["street", "city", "state", "zip"],
        "full_address",
        "STRING",
      );

      expect(multiColumnService.getSourceColumns()).toEqual(["street", "city", "state", "zip"]);
      expect(multiColumnService.getTargetColumn()).toBe("full_address");
    });

    it("should work with different target types", () => {
      const numericService = new TestDataEnrichmentService(["value1", "value2"], "sum", "DOUBLE");

      expect(numericService.getTargetType()).toBe("DOUBLE");
    });
  });
});
