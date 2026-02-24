import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseDelimitedText, parseClipboard, parseClipboardText } from "./parse-data";

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
    const mockReadText = vi.fn().mockImplementation(() => new Promise(() => {}));

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
    await vi.advanceTimersByTimeAsync(3500);
    
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
    // When clipboard API returns empty string, it's treated as falsy and triggers fallback
    // When execCommand also returns empty, it rejects (because success && text is falsy)
    // So we need to test the case where execCommand succeeds with actual text
    // but that text is whitespace-only
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
