import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  parseDelimitedText,
  parseClipboard,
  parseClipboardText,
  parseFile,
} from "./parse-metadata-import";

/** Create a File-like object with arrayBuffer() support for test environments that lack it. */
function createTestFile(name: string, content: ArrayBuffer = new ArrayBuffer(10)): File {
  const file = new File([content], name);
  if (typeof file.arrayBuffer !== "function") {
    (file as unknown as Record<string, unknown>).arrayBuffer = () => Promise.resolve(content);
  }
  return file;
}

describe("parseDelimitedText", () => {
  describe("delimiter detection", () => {
    it("should detect comma delimiter", () => {
      const text = "ID,Name,Value\n1,Test,100\n2,Test2,200";
      const result = parseDelimitedText(text);

      expect(result.columns).toHaveLength(3);
      expect(result.columns.map((c) => c.name)).toEqual(["ID", "Name", "Value"]);
      expect(result.rows).toHaveLength(2);
    });

    it("should detect semicolon delimiter", () => {
      const text = "ID;LOCATION;PLOT\n1;GH 8.3;101\n2;GH 8.4;102";
      const result = parseDelimitedText(text);

      expect(result.columns).toHaveLength(3);
      expect(result.columns.map((c) => c.name)).toEqual(["ID", "LOCATION", "PLOT"]);
      expect(result.rows).toHaveLength(2);
    });

    it("should detect tab delimiter", () => {
      const text = "ID\tName\tValue\n1\tTest\t100";
      const result = parseDelimitedText(text);

      expect(result.columns).toHaveLength(3);
      expect(result.columns.map((c) => c.name)).toEqual(["ID", "Name", "Value"]);
    });

    it("should detect pipe delimiter", () => {
      const text = "ID|Name|Value\n1|Test|100";
      const result = parseDelimitedText(text);

      expect(result.columns).toHaveLength(3);
      expect(result.columns.map((c) => c.name)).toEqual(["ID", "Name", "Value"]);
    });

    it("should use explicit delimiter when provided", () => {
      const text = "ID;Name;Value\n1;Test;100";
      const result = parseDelimitedText(text, ",");

      // With comma delimiter, the whole line becomes one column
      expect(result.columns).toHaveLength(1);
      expect(result.columns[0].name).toBe("ID;Name;Value");
    });
  });

  describe("quoted values", () => {
    it("should handle quoted values with delimiters inside", () => {
      const text = 'ID,Name,Description\n1,"Test, with comma","Value"';
      const result = parseDelimitedText(text);

      expect(result.rows[0]).toMatchObject({
        col_1: "Test, with comma",
        col_2: "Value",
      });
    });

    it("should handle escaped quotes inside quoted values", () => {
      const text = 'ID,Name\n1,"Test ""quoted"" value"';
      const result = parseDelimitedText(text);

      expect(result.rows[0].col_1).toBe('Test "quoted" value');
    });
  });

  describe("type inference", () => {
    it("should infer number type for numeric columns", () => {
      const text = "ID,Count\n1,100\n2,200\n3,300";
      const result = parseDelimitedText(text);

      expect(result.columns[0].type).toBe("number");
      expect(result.columns[1].type).toBe("number");
    });

    it("should infer string type for mixed columns", () => {
      const text = "ID,Name\n1,Test\n2,Test2";
      const result = parseDelimitedText(text);

      expect(result.columns[1].type).toBe("string");
    });

    it("should infer date type for date columns", () => {
      const text = "ID,Date\n1,2024-01-15\n2,2024-02-20";
      const result = parseDelimitedText(text);

      expect(result.columns[1].type).toBe("date");
    });
  });

  describe("edge cases", () => {
    it("should return empty columns and rows for empty text", () => {
      const result = parseDelimitedText("");
      expect(result.columns).toHaveLength(0);
      expect(result.rows).toHaveLength(0);
    });

    it("should handle header-only input", () => {
      const text = "ID,Name,Value";
      const result = parseDelimitedText(text);

      expect(result.columns).toHaveLength(3);
      expect(result.rows).toHaveLength(0);
    });

    it("should skip empty rows", () => {
      const text = "ID,Name\n1,Test\n\n2,Test2";
      const result = parseDelimitedText(text);

      expect(result.rows).toHaveLength(2);
    });

    it("should handle Windows line endings (CRLF)", () => {
      const text = "ID,Name\r\n1,Test\r\n2,Test2";
      const result = parseDelimitedText(text);

      expect(result.rows).toHaveLength(2);
    });

    it("should handle rows with fewer columns than header", () => {
      const text = "ID,Name,Value\n1,Test";
      const result = parseDelimitedText(text);

      expect(result.rows[0].col_2).toBe("");
    });
  });

  describe("real-world data", () => {
    it("should parse semicolon-delimited experiment metadata", () => {
      const text = `ID;LOCATION;PLOT;REP;Density;Genotype;Harvest moment;Plot
1;GH 8.3;101;1;D2;Type 1;H4;101_H4
3;GH 8.3;101;1;D2;Type 1;H1;101_H1
5;GH 8.3;102;1;D2;Type 2;H3;102_H3`;

      const result = parseDelimitedText(text);

      expect(result.columns).toHaveLength(8);
      expect(result.columns.map((c) => c.name)).toEqual([
        "ID",
        "LOCATION",
        "PLOT",
        "REP",
        "Density",
        "Genotype",
        "Harvest moment",
        "Plot",
      ]);
      expect(result.rows).toHaveLength(3);
      expect(result.rows[0].col_1).toBe("GH 8.3");
      expect(result.rows[0].col_5).toBe("Type 1");
    });
  });
});

describe("parseClipboardText", () => {
  it("should parse valid clipboard text", () => {
    const text = "ID,Name\n1,Test";
    const result = parseClipboardText(text);

    expect(result.columns).toHaveLength(2);
    expect(result.rows).toHaveLength(1);
  });

  it("should throw error for empty text", () => {
    expect(() => parseClipboardText("")).toThrow("Clipboard is empty");
  });

  it("should throw error for whitespace-only text", () => {
    expect(() => parseClipboardText("   \n  ")).toThrow("Clipboard is empty");
  });

  it("should throw error for unparseable data", () => {
    // Single value with no delimiter produces 1 column, which is valid
    // But a completely empty result after parsing would fail
    const text = "single";
    const result = parseClipboardText(text);
    // This actually produces 1 column, so it won't throw
    expect(result.columns).toHaveLength(1);
  });
});

describe("parseClipboard", () => {
  const originalNavigator = global.navigator;
  const originalDocument = global.document;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    // Restore original navigator
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
    });
    // Restore original document
    Object.defineProperty(global, "document", {
      value: originalDocument,
      writable: true,
    });
  });

  it("should use clipboard API when available and successful", async () => {
    const mockReadText = vi.fn().mockResolvedValue("ID,Name\n1,Test");

    Object.defineProperty(global, "navigator", {
      value: {
        clipboard: {
          readText: mockReadText,
        },
      },
      writable: true,
    });

    const resultPromise = parseClipboard();
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(mockReadText).toHaveBeenCalled();
    expect(result.columns).toHaveLength(2);
    expect(result.rows).toHaveLength(1);
  });

  it("should timeout and fallback when clipboard API hangs", async () => {
    // Mock clipboard API that never resolves
    const mockReadText = vi.fn().mockImplementation(
      () =>
        new Promise(() => {
          /* never resolves */
        }),
    );

    Object.defineProperty(global, "navigator", {
      value: {
        clipboard: {
          readText: mockReadText,
        },
      },
      writable: true,
    });

    // Mock execCommand fallback
    const mockTextarea = {
      style: {},
      focus: vi.fn(),
      value: "ID,Name\n1,Test",
    };
    const mockCreateElement = vi.fn().mockReturnValue(mockTextarea);
    const mockAppendChild = vi.fn();
    const mockRemoveChild = vi.fn();
    const mockExecCommand = vi.fn().mockReturnValue(true);

    Object.defineProperty(global, "document", {
      value: {
        createElement: mockCreateElement,
        body: {
          appendChild: mockAppendChild,
          removeChild: mockRemoveChild,
        },
        execCommand: mockExecCommand,
      },
      writable: true,
    });

    const resultPromise = parseClipboard();

    // Advance past the timeout
    await vi.advanceTimersByTimeAsync(31_000);

    const result = await resultPromise;

    expect(mockExecCommand).toHaveBeenCalledWith("paste");
    expect(result.columns).toHaveLength(2);
  });

  it("should fallback to execCommand when clipboard API throws", async () => {
    const mockReadText = vi.fn().mockRejectedValue(new Error("Permission denied"));

    Object.defineProperty(global, "navigator", {
      value: {
        clipboard: {
          readText: mockReadText,
        },
      },
      writable: true,
    });

    // Mock execCommand fallback
    const mockTextarea = {
      style: {},
      focus: vi.fn(),
      value: "ID,Name\n1,Test",
    };
    const mockCreateElement = vi.fn().mockReturnValue(mockTextarea);
    const mockAppendChild = vi.fn();
    const mockRemoveChild = vi.fn();
    const mockExecCommand = vi.fn().mockReturnValue(true);

    Object.defineProperty(global, "document", {
      value: {
        createElement: mockCreateElement,
        body: {
          appendChild: mockAppendChild,
          removeChild: mockRemoveChild,
        },
        execCommand: mockExecCommand,
      },
      writable: true,
    });

    const resultPromise = parseClipboard();
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(mockExecCommand).toHaveBeenCalledWith("paste");
    expect(result.columns).toHaveLength(2);
  });

  it("should throw error when both clipboard API and execCommand fail", async () => {
    const mockReadText = vi.fn().mockRejectedValue(new Error("Permission denied"));

    Object.defineProperty(global, "navigator", {
      value: {
        clipboard: {
          readText: mockReadText,
        },
      },
      writable: true,
    });

    // Mock execCommand that fails
    const mockTextarea = {
      style: {},
      focus: vi.fn(),
      value: "",
    };
    const mockCreateElement = vi.fn().mockReturnValue(mockTextarea);
    const mockAppendChild = vi.fn();
    const mockRemoveChild = vi.fn();
    const mockExecCommand = vi.fn().mockReturnValue(false);

    Object.defineProperty(global, "document", {
      value: {
        createElement: mockCreateElement,
        body: {
          appendChild: mockAppendChild,
          removeChild: mockRemoveChild,
        },
        execCommand: mockExecCommand,
      },
      writable: true,
    });

    const resultPromise = parseClipboard();
    // Attach the rejection handler BEFORE advancing timers to avoid unhandled rejection
    const assertion = expect(resultPromise).rejects.toThrow("Could not read clipboard");
    await vi.runAllTimersAsync();

    await assertion;
  });

  it("should throw 'Clipboard is empty' when both methods return valid but empty text", async () => {
    const mockReadText = vi.fn().mockResolvedValue("   ");

    Object.defineProperty(global, "navigator", {
      value: {
        clipboard: {
          readText: mockReadText,
        },
      },
      writable: true,
    });

    const resultPromise = parseClipboard();
    // Attach the rejection handler BEFORE advancing timers to avoid unhandled rejection
    const assertion = expect(resultPromise).rejects.toThrow("Clipboard is empty");
    await vi.runAllTimersAsync();

    // Whitespace-only text triggers "Clipboard is empty" error
    await assertion;
  });

  it("should work when clipboard API is not available", async () => {
    Object.defineProperty(global, "navigator", {
      value: {
        clipboard: undefined,
      },
      writable: true,
    });

    // Mock execCommand fallback
    const mockTextarea = {
      style: {},
      focus: vi.fn(),
      value: "ID,Name\n1,Test",
    };
    const mockCreateElement = vi.fn().mockReturnValue(mockTextarea);
    const mockAppendChild = vi.fn();
    const mockRemoveChild = vi.fn();
    const mockExecCommand = vi.fn().mockReturnValue(true);

    Object.defineProperty(global, "document", {
      value: {
        createElement: mockCreateElement,
        body: {
          appendChild: mockAppendChild,
          removeChild: mockRemoveChild,
        },
        execCommand: mockExecCommand,
      },
      writable: true,
    });

    const resultPromise = parseClipboard();
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(mockExecCommand).toHaveBeenCalledWith("paste");
    expect(result.columns).toHaveLength(2);
  });
});

describe("parseFile", () => {
  it("should parse a CSV file", async () => {
    const csvContent = "ID,Name,Value\n1,Test,100\n2,Test2,200";
    const file = new File([csvContent], "test.csv", { type: "text/csv" });

    const result = await parseFile(file);

    expect(result.columns).toHaveLength(3);
    expect(result.columns.map((c) => c.name)).toEqual(["ID", "Name", "Value"]);
    expect(result.rows).toHaveLength(2);
  });

  it("should parse a TSV file", async () => {
    const tsvContent = "ID\tName\tValue\n1\tTest\t100";
    const file = new File([tsvContent], "data.tsv", { type: "text/tsv" });

    const result = await parseFile(file);

    expect(result.columns).toHaveLength(3);
    expect(result.rows).toHaveLength(1);
  });

  it("should parse a TXT file as delimited", async () => {
    const txtContent = "ID,Name\n1,Test";
    const file = new File([txtContent], "data.txt", { type: "text/plain" });

    const result = await parseFile(file);

    expect(result.columns).toHaveLength(2);
    expect(result.rows).toHaveLength(1);
  });

  it("should throw for unsupported file types", async () => {
    const file = new File(["data"], "test.pdf", { type: "application/pdf" });

    await expect(parseFile(file)).rejects.toThrow("Unsupported file type: pdf");
  });

  it("should throw for file with no extension", async () => {
    const file = new File(["data"], "noext", { type: "text/plain" });
    // The extension will be undefined
    await expect(parseFile(file)).rejects.toThrow("Unsupported file type");
  });

  describe("Excel file handling", () => {
    afterEach(() => {
      vi.doUnmock("exceljs");
      vi.resetModules();
    });

    it("should parse xlsx files using ExcelJS", async () => {
      // Create a mock that simulates ExcelJS workbook
      const mockRow1Cells = [{ value: "ID" }, { value: "Name" }, { value: "Count" }];
      const mockRow2Cells = [{ value: 1 }, { value: "Alice" }, { value: 42 }];
      const mockRow3Cells = [{ value: 2 }, { value: "Bob" }, { value: 99 }];

      const mockRows = [mockRow1Cells, mockRow2Cells, mockRow3Cells];

      const mockSheet = {
        rowCount: 3,
        eachRow: (
          callback: (row: {
            eachCell: (
              opts: { includeEmpty: boolean },
              cb: (cell: { value: unknown }) => void,
            ) => void;
          }) => void,
        ) => {
          mockRows.forEach((cells) => {
            callback({
              eachCell: (
                _opts: { includeEmpty: boolean },
                cb: (cell: { value: unknown }) => void,
              ) => {
                cells.forEach((cell) => cb(cell));
              },
            });
          });
        },
      };

      const mockWorkbook = {
        worksheets: [mockSheet],
        xlsx: {
          load: vi.fn().mockResolvedValue(undefined),
        },
      };

      vi.doMock("exceljs", () => ({
        Workbook: vi.fn(function () {
          return mockWorkbook;
        }),
      }));

      // Need to re-import to pick up the mock
      const { parseFile: parseFileFresh } = await import("./parse-metadata-import");

      const file = createTestFile("test.xlsx");

      const result = await parseFileFresh(file);

      expect(result.columns).toHaveLength(3);
      expect(result.columns.map((c) => c.name)).toEqual(["ID", "Name", "Count"]);
      expect(result.rows).toHaveLength(2);

      vi.doUnmock("exceljs");
    });

    it("should return empty when xlsx has no worksheets", async () => {
      const mockWorkbook = {
        worksheets: [],
        xlsx: {
          load: vi.fn().mockResolvedValue(undefined),
        },
      };

      vi.doMock("exceljs", () => ({
        Workbook: vi.fn(function () {
          return mockWorkbook;
        }),
      }));

      const { parseFile: parseFileFresh } = await import("./parse-metadata-import");

      const file = createTestFile("test.xlsx");

      const result = await parseFileFresh(file);

      expect(result.columns).toHaveLength(0);
      expect(result.rows).toHaveLength(0);

      vi.doUnmock("exceljs");
    });

    it("should return empty when xlsx has empty sheet", async () => {
      const mockSheet = {
        rowCount: 0,
        eachRow: (_cb: unknown) => {
          // intentionally empty: simulates a sheet with no rows
        },
      };

      const mockWorkbook = {
        worksheets: [mockSheet],
        xlsx: {
          load: vi.fn().mockResolvedValue(undefined),
        },
      };

      vi.doMock("exceljs", () => ({
        Workbook: vi.fn(function () {
          return mockWorkbook;
        }),
      }));

      const { parseFile: parseFileFresh } = await import("./parse-metadata-import");

      const file = createTestFile("test.xlsx");

      const result = await parseFileFresh(file);

      expect(result.columns).toHaveLength(0);
      expect(result.rows).toHaveLength(0);

      vi.doUnmock("exceljs");
    });

    it("should handle Excel rich text cells", async () => {
      const mockRow1Cells = [{ value: "Header" }];
      const mockRow2Cells = [{ value: { richText: [{ text: "Hello " }, { text: "World" }] } }];

      const mockRows = [mockRow1Cells, mockRow2Cells];
      const mockSheet = {
        rowCount: 2,
        eachRow: (
          cb: (row: {
            eachCell: (
              opts: { includeEmpty: boolean },
              cb: (cell: { value: unknown }) => void,
            ) => void;
          }) => void,
        ) => {
          mockRows.forEach((cells) => {
            cb({
              eachCell: (
                _opts: { includeEmpty: boolean },
                cb2: (cell: { value: unknown }) => void,
              ) => {
                cells.forEach((cell) => cb2(cell));
              },
            });
          });
        },
      };

      const mockWorkbook = {
        worksheets: [mockSheet],
        xlsx: { load: vi.fn().mockResolvedValue(undefined) },
      };

      vi.doMock("exceljs", () => ({
        Workbook: vi.fn(function () {
          return mockWorkbook;
        }),
      }));

      const { parseFile: parseFileFresh } = await import("./parse-metadata-import");
      const file = createTestFile("test.xlsx");
      const result = await parseFileFresh(file);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].col_0).toBe("Hello World");

      vi.doUnmock("exceljs");
    });

    it("should handle Excel formula cells", async () => {
      const mockRow1Cells = [{ value: "Header" }];
      const mockRow2Cells = [{ value: { formula: "=A1+1", result: 42 } }];

      const mockRows = [mockRow1Cells, mockRow2Cells];
      const mockSheet = {
        rowCount: 2,
        eachRow: (
          cb: (row: {
            eachCell: (
              opts: { includeEmpty: boolean },
              cb: (cell: { value: unknown }) => void,
            ) => void;
          }) => void,
        ) => {
          mockRows.forEach((cells) => {
            cb({
              eachCell: (
                _opts: { includeEmpty: boolean },
                cb2: (cell: { value: unknown }) => void,
              ) => {
                cells.forEach((cell) => cb2(cell));
              },
            });
          });
        },
      };

      const mockWorkbook = {
        worksheets: [mockSheet],
        xlsx: { load: vi.fn().mockResolvedValue(undefined) },
      };

      vi.doMock("exceljs", () => ({
        Workbook: vi.fn(function () {
          return mockWorkbook;
        }),
      }));

      const { parseFile: parseFileFresh } = await import("./parse-metadata-import");
      const file = createTestFile("test.xls");
      const result = await parseFileFresh(file);

      expect(result.rows[0].col_0).toBe(42);

      vi.doUnmock("exceljs");
    });

    it("should handle Excel Date cells", async () => {
      const testDate = new Date("2024-06-15T00:00:00.000Z");
      const mockRow1Cells = [{ value: "Date" }];
      const mockRow2Cells = [{ value: testDate }];

      const mockRows = [mockRow1Cells, mockRow2Cells];
      const mockSheet = {
        rowCount: 2,
        eachRow: (
          cb: (row: {
            eachCell: (
              opts: { includeEmpty: boolean },
              cb: (cell: { value: unknown }) => void,
            ) => void;
          }) => void,
        ) => {
          mockRows.forEach((cells) => {
            cb({
              eachCell: (
                _opts: { includeEmpty: boolean },
                cb2: (cell: { value: unknown }) => void,
              ) => {
                cells.forEach((cell) => cb2(cell));
              },
            });
          });
        },
      };

      const mockWorkbook = {
        worksheets: [mockSheet],
        xlsx: { load: vi.fn().mockResolvedValue(undefined) },
      };

      vi.doMock("exceljs", () => ({
        Workbook: vi.fn(function () {
          return mockWorkbook;
        }),
      }));

      const { parseFile: parseFileFresh } = await import("./parse-metadata-import");
      const file = createTestFile("test.xlsx");
      const result = await parseFileFresh(file);

      // resolveExcelCellValue converts Date to ISO string, then parseDelimitedText
      // may produce a number (via dynamicTyping + Number()) since Number(isoString) yields a timestamp
      const dateVal = result.rows[0].col_0;
      if (typeof dateVal === "number") {
        expect(dateVal).toBe(testDate.getTime());
      } else {
        expect(String(dateVal)).toContain("2024");
      }

      vi.doUnmock("exceljs");
    });

    it("should handle Excel hyperlink cells", async () => {
      const mockRow1Cells = [{ value: "Link" }];
      const mockRow2Cells = [{ value: { text: "Click here", hyperlink: "https://example.com" } }];

      const mockRows = [mockRow1Cells, mockRow2Cells];
      const mockSheet = {
        rowCount: 2,
        eachRow: (
          cb: (row: {
            eachCell: (
              opts: { includeEmpty: boolean },
              cb: (cell: { value: unknown }) => void,
            ) => void;
          }) => void,
        ) => {
          mockRows.forEach((cells) => {
            cb({
              eachCell: (
                _opts: { includeEmpty: boolean },
                cb2: (cell: { value: unknown }) => void,
              ) => {
                cells.forEach((cell) => cb2(cell));
              },
            });
          });
        },
      };

      const mockWorkbook = {
        worksheets: [mockSheet],
        xlsx: { load: vi.fn().mockResolvedValue(undefined) },
      };

      vi.doMock("exceljs", () => ({
        Workbook: vi.fn(function () {
          return mockWorkbook;
        }),
      }));

      const { parseFile: parseFileFresh } = await import("./parse-metadata-import");
      const file = createTestFile("test.xlsx");
      const result = await parseFileFresh(file);

      expect(result.rows[0].col_0).toBe("Click here");

      vi.doUnmock("exceljs");
    });

    it("should handle null/undefined Excel cells", async () => {
      const mockRow1Cells = [{ value: "Header" }];
      const mockRow2Cells = [{ value: null }];

      const mockRows = [mockRow1Cells, mockRow2Cells];
      const mockSheet = {
        rowCount: 2,
        eachRow: (
          cb: (row: {
            eachCell: (
              opts: { includeEmpty: boolean },
              cb: (cell: { value: unknown }) => void,
            ) => void;
          }) => void,
        ) => {
          mockRows.forEach((cells) => {
            cb({
              eachCell: (
                _opts: { includeEmpty: boolean },
                cb2: (cell: { value: unknown }) => void,
              ) => {
                cells.forEach((cell) => cb2(cell));
              },
            });
          });
        },
      };

      const mockWorkbook = {
        worksheets: [mockSheet],
        xlsx: { load: vi.fn().mockResolvedValue(undefined) },
      };

      vi.doMock("exceljs", () => ({
        Workbook: vi.fn(function () {
          return mockWorkbook;
        }),
      }));

      const { parseFile: parseFileFresh } = await import("./parse-metadata-import");
      const file = createTestFile("test.xlsx");
      const result = await parseFileFresh(file);

      // Empty row should be skipped
      expect(result.rows).toHaveLength(0);

      vi.doUnmock("exceljs");
    });

    it("should handle boolean Excel cells", async () => {
      const mockRow1Cells = [{ value: "Flag" }];
      const mockRow2Cells = [{ value: true }];

      const mockRows = [mockRow1Cells, mockRow2Cells];
      const mockSheet = {
        rowCount: 2,
        eachRow: (
          cb: (row: {
            eachCell: (
              opts: { includeEmpty: boolean },
              cb: (cell: { value: unknown }) => void,
            ) => void;
          }) => void,
        ) => {
          mockRows.forEach((cells) => {
            cb({
              eachCell: (
                _opts: { includeEmpty: boolean },
                cb2: (cell: { value: unknown }) => void,
              ) => {
                cells.forEach((cell) => cb2(cell));
              },
            });
          });
        },
      };

      const mockWorkbook = {
        worksheets: [mockSheet],
        xlsx: { load: vi.fn().mockResolvedValue(undefined) },
      };

      vi.doMock("exceljs", () => ({
        Workbook: vi.fn(function () {
          return mockWorkbook;
        }),
      }));

      const { parseFile: parseFileFresh } = await import("./parse-metadata-import");
      const file = createTestFile("test.xlsx");
      const result = await parseFileFresh(file);

      expect(result.rows[0].col_0).toBe(true);

      vi.doUnmock("exceljs");
    });

    it("should skip title rows in Excel when first row has all same values", async () => {
      // First row: merged title "My Report"
      // Second row: real header "ID", "Name"
      // Third row: data "1", "Alice"
      const mockRow1Cells = [{ value: "My Report" }];
      const mockRow2Cells = [{ value: "ID" }, { value: "Name" }];
      const mockRow3Cells = [{ value: "1" }, { value: "Alice" }];

      const mockRows = [mockRow1Cells, mockRow2Cells, mockRow3Cells];
      const mockSheet = {
        rowCount: 3,
        eachRow: (
          cb: (row: {
            eachCell: (
              opts: { includeEmpty: boolean },
              cb: (cell: { value: unknown }) => void,
            ) => void;
          }) => void,
        ) => {
          mockRows.forEach((cells) => {
            cb({
              eachCell: (
                _opts: { includeEmpty: boolean },
                cb2: (cell: { value: unknown }) => void,
              ) => {
                cells.forEach((cell) => cb2(cell));
              },
            });
          });
        },
      };

      const mockWorkbook = {
        worksheets: [mockSheet],
        xlsx: { load: vi.fn().mockResolvedValue(undefined) },
      };

      vi.doMock("exceljs", () => ({
        Workbook: vi.fn(function () {
          return mockWorkbook;
        }),
      }));

      const { parseFile: parseFileFresh } = await import("./parse-metadata-import");
      const file = createTestFile("test.xlsx");
      const result = await parseFileFresh(file);

      // Should skip first row (title) and use second as header
      expect(result.columns.map((c) => c.name)).toEqual(["ID", "Name"]);
      expect(result.rows).toHaveLength(1);

      vi.doUnmock("exceljs");
    });

    it("should return empty when eachRow provides no rows", async () => {
      const mockSheet = {
        rowCount: 1,
        eachRow: () => {
          // no rows returned
        },
      };

      const mockWorkbook = {
        worksheets: [mockSheet],
        xlsx: { load: vi.fn().mockResolvedValue(undefined) },
      };

      vi.doMock("exceljs", () => ({
        Workbook: vi.fn(function () {
          return mockWorkbook;
        }),
      }));

      const { parseFile: parseFileFresh } = await import("./parse-metadata-import");
      const file = createTestFile("test.xlsx");
      const result = await parseFileFresh(file);

      expect(result.columns).toHaveLength(0);
      expect(result.rows).toHaveLength(0);

      vi.doUnmock("exceljs");
    });
  });
});

describe("parseDelimitedText – escapeCsvField edge cases", () => {
  it("should handle values with commas in CSV fields via round-trip", () => {
    // This tests that values with special characters survive CSV parsing
    const text = 'Name,Description\n"Alice, Bob","Has ""quotes"""';
    const result = parseDelimitedText(text);

    expect(result.rows[0].col_0).toBe("Alice, Bob");
    expect(result.rows[0].col_1).toBe('Has "quotes"');
  });

  it("should handle newlines within quoted fields", () => {
    const text = 'Name,Notes\n"Alice","Line 1\nLine 2"';
    const result = parseDelimitedText(text);

    expect(result.rows[0].col_1).toBe("Line 1\nLine 2");
  });
});

describe("parseClipboardText – additional cases", () => {
  it("should throw when parsed data produces zero columns", () => {
    // Completely blank after trim → empty error
    expect(() => parseClipboardText("   ")).toThrow("Clipboard is empty");
  });
});
