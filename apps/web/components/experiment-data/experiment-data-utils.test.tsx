import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { formatValue, LoadingRows } from "./experiment-data-utils";

// Mock i18n
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "experimentDataTable.noResults": "No results found",
        "experimentDataTable.loading": "Loading...",
      };
      return translations[key] || key;
    },
  }),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
  TableCell: ({ children, ...props }: { children: React.ReactNode; colSpan?: number }) => (
    <td {...props}>{children}</td>
  ),
  TableRow: ({ children, ...props }: { children: React.ReactNode }) => (
    <tr {...props}>{children}</tr>
  ),
}));

describe("experiment-data-utils", () => {
  describe("formatValue", () => {
    it("should format numeric values with right alignment", () => {
      const result = formatValue(123.45, "DOUBLE");
      expect(result).toEqual(<div className="text-right tabular-nums">{123.45}</div>);
    });

    it("should format INT values with right alignment", () => {
      const result = formatValue(42, "INT");
      expect(result).toEqual(<div className="text-right tabular-nums">{42}</div>);
    });

    it("should format LONG values with right alignment", () => {
      const result = formatValue(1234567890, "LONG");
      expect(result).toEqual(<div className="text-right tabular-nums">{1234567890}</div>);
    });

    it("should format BIGINT values with right alignment", () => {
      const result = formatValue(9876543210, "BIGINT");
      expect(result).toEqual(<div className="text-right tabular-nums">{9876543210}</div>);
    });

    it("should format TIMESTAMP values by truncating and replacing T", () => {
      const result = formatValue("2023-01-01T10:30:45.123Z", "TIMESTAMP");
      expect(result).toBe("2023-01-01 10:30:45");
    });

    it("should return string values as-is for other types", () => {
      const result = formatValue("test string", "STRING");
      expect(result).toBe("test string");
    });

    it("should handle null values", () => {
      const result = formatValue(null, "STRING");
      expect(result).toBeNull();
    });
  });

  describe("LoadingRows", () => {
    it("should render loading message and skeleton rows", () => {
      render(
        <table>
          <tbody>
            <LoadingRows rowCount={3} columnCount={2} />
          </tbody>
        </table>,
      );

      expect(screen.getByText("Loading...")).toBeInTheDocument();

      // Should render 2 skeleton rows (rowCount - 1, since first row shows loading message)
      const skeletons = screen.getAllByTestId("skeleton");
      expect(skeletons).toHaveLength(4); // 2 rows × 2 columns
    });

    it("should render correct number of skeleton cells", () => {
      render(
        <table>
          <tbody>
            <LoadingRows rowCount={2} columnCount={3} />
          </tbody>
        </table>,
      );

      // Should render 1 skeleton row (rowCount - 1) with 3 columns
      const skeletons = screen.getAllByTestId("skeleton");
      expect(skeletons).toHaveLength(3); // 1 row × 3 columns
    });
  });
});
