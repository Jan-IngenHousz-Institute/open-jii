import { describe, it, expect } from "vitest";

import { formatFileSize } from "./format-file-size";

describe("formatFileSize", () => {
  it("should format zero bytes correctly", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });

  it("should format bytes correctly", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1023)).toBe("1023 B");
  });

  it("should format kilobytes correctly", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(1048575)).toBe("1024 KB");
  });

  it("should format megabytes correctly", () => {
    expect(formatFileSize(1048576)).toBe("1 MB");
    expect(formatFileSize(1572864)).toBe("1.5 MB");
    expect(formatFileSize(2097152)).toBe("2 MB");
    expect(formatFileSize(1073741823)).toBe("1024 MB");
  });

  it("should format gigabytes correctly", () => {
    expect(formatFileSize(1073741824)).toBe("1 GB");
    expect(formatFileSize(1610612736)).toBe("1.5 GB");
    expect(formatFileSize(2147483648)).toBe("2 GB");
    expect(formatFileSize(10737418240)).toBe("10 GB");
  });

  it("should handle large numbers correctly", () => {
    expect(formatFileSize(1099511627776)).toBe("1024 GB");
  });

  it("should round to one decimal place", () => {
    expect(formatFileSize(1049)).toBe("1 KB");
    expect(formatFileSize(1075)).toBe("1 KB"); // 1075 / 1024 = 1.0498... rounds to 1.0
    expect(formatFileSize(1126)).toBe("1.1 KB");
    expect(formatFileSize(1178)).toBe("1.2 KB");
  });
});
