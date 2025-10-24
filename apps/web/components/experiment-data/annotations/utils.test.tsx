import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { FormProvider, useForm } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import { it, expect, vi, describe } from "vitest";
import type { AnnotationsProps } from "~/components/experiment-data/annotations/annotations";
import {
  getAllRowsSelectionCheckbox,
  getAnnotationData,
  getAnnotationsColumn,
  getRowSelectionCheckbox,
  getTotalSelectedCounts,
  isAnnotationData,
} from "~/components/experiment-data/annotations/utils";
import type { BulkSelectionFormType } from "~/components/experiment-data/experiment-data-table";
import type {
  AnnotationData,
  DataRow,
} from "~/hooks/experiment/useExperimentData/useExperimentData";

import type { Annotation } from "@repo/api";

// Mock Annotations
vi.mock("~/components/experiment-data/annotations/annotations", () => ({
  Annotations: ({ experimentId, tableName, rowIds, data }: AnnotationsProps) => (
    <div
      data-testid="render-comments-and-flags"
      data-experimentid={experimentId}
      data-tablename={tableName}
      data-rowids={rowIds.join(",")}
      data-data={data}
    >
      Annotations
    </div>
  ),
}));

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  observe() {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  unobserve() {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  disconnect() {}
};

describe("getAnnotationData", () => {
  const comment1: Annotation = {
    id: uuidv4(),
    userId: uuidv4(),
    userName: "User One",
    type: "comment",
    content: { text: "Test comment 1" },
    createdAt: "2025-09-01T00:00:00Z",
    updatedAt: "2025-09-01T00:00:00Z",
  };

  const flag1: Annotation = {
    id: uuidv4(),
    userId: uuidv4(),
    userName: "User Three",
    type: "flag",
    content: { flagType: "outlier", reason: "Flagged as outlier" },
    createdAt: "2025-09-03T00:00:00Z",
    updatedAt: "2025-09-03T00:00:00Z",
  };

  const flag2: Annotation = {
    id: uuidv4(),
    userId: uuidv4(),
    userName: "User Four",
    type: "flag",
    content: { flagType: "needs_review", reason: "Needs review" },
    createdAt: "2025-09-04T00:00:00Z",
    updatedAt: "2025-09-04T00:00:00Z",
  };

  it("should aggregate annotation data correctly", () => {
    const annotations: Annotation[] = [comment1, flag1, flag2];

    const result = getAnnotationData(annotations);

    expect(result.count).toBe(3);
    expect(result.commentCount).toBe(1);
    expect(result.flagCount).toBe(2);
    expect(Array.from(result.uniqueFlags)).toEqual(["outlier", "needs_review"]);
    expect(result.annotationsPerType.comment).toHaveLength(1);
    expect(result.annotationsPerType.flag).toHaveLength(2);
  });

  it("should handle empty annotations array", () => {
    const result = getAnnotationData([]);
    expect(result.count).toBe(0);
    expect(result.commentCount).toBe(0);
    expect(result.flagCount).toBe(0);
    expect(Array.from(result.uniqueFlags)).toEqual([]);
    expect(result.annotationsPerType).toEqual({});
  });
});

describe("isAnnotationData", () => {
  const comment1: Annotation = {
    id: uuidv4(),
    userId: uuidv4(),
    userName: "User One",
    type: "comment",
    content: { text: "Test comment 1" },
    createdAt: "2025-09-01T00:00:00Z",
    updatedAt: "2025-09-01T00:00:00Z",
  };

  const flag1: Annotation = {
    id: uuidv4(),
    userId: uuidv4(),
    userName: "User Three",
    type: "flag",
    content: { flagType: "outlier", reason: "Flagged as outlier" },
    createdAt: "2025-09-03T00:00:00Z",
    updatedAt: "2025-09-03T00:00:00Z",
  };

  it("should return true for valid AnnotationData", () => {
    const validData = {
      annotations: [comment1, flag1],
      annotationsPerType: { comment: [comment1], flag: [flag1] },
      uniqueFlags: new Set(["outlier"]),
      count: 2,
      commentCount: 1,
      flagCount: 1,
    };

    expect(isAnnotationData(validData)).toBe(true);
  });

  it("should return false for null", () => {
    expect(isAnnotationData(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isAnnotationData(undefined)).toBe(false);
  });

  it("should return false for primitive types", () => {
    expect(isAnnotationData("string")).toBe(false);
    expect(isAnnotationData(123)).toBe(false);
    expect(isAnnotationData(true)).toBe(false);
  });

  it("should return false when annotations is not an array", () => {
    const invalidData = {
      annotations: "not an array",
      annotationsPerType: {},
      uniqueFlags: new Set(),
      count: 0,
      commentCount: 0,
      flagCount: 0,
    };

    expect(isAnnotationData(invalidData)).toBe(false);
  });

  it("should return false when annotationsPerType is not an object", () => {
    const invalidData = {
      annotations: [],
      annotationsPerType: "not an object",
      uniqueFlags: new Set(),
      count: 0,
      commentCount: 0,
      flagCount: 0,
    };

    expect(isAnnotationData(invalidData)).toBe(false);
  });

  it("should return false when uniqueFlags is not a Set", () => {
    const invalidData = {
      annotations: [],
      annotationsPerType: {},
      uniqueFlags: ["not", "a", "set"],
      count: 0,
      commentCount: 0,
      flagCount: 0,
    };

    expect(isAnnotationData(invalidData)).toBe(false);
  });

  it("should return false when count is not a number", () => {
    const invalidData = {
      annotations: [],
      annotationsPerType: {},
      uniqueFlags: new Set(),
      count: "not a number",
      commentCount: 0,
      flagCount: 0,
    };

    expect(isAnnotationData(invalidData)).toBe(false);
  });

  it("should return false when commentCount is not a number", () => {
    const invalidData = {
      annotations: [],
      annotationsPerType: {},
      uniqueFlags: new Set(),
      count: 0,
      commentCount: "not a number",
      flagCount: 0,
    };

    expect(isAnnotationData(invalidData)).toBe(false);
  });

  it("should return false when flagCount is not a number", () => {
    const invalidData = {
      annotations: [],
      annotationsPerType: {},
      uniqueFlags: new Set(),
      count: 0,
      commentCount: 0,
      flagCount: "not a number",
    };

    expect(isAnnotationData(invalidData)).toBe(false);
  });

  it("should return false when required properties are missing", () => {
    const incompleteData = {
      annotations: [],
      annotationsPerType: {},
      // missing uniqueFlags, count, commentCount, flagCount
    };

    expect(isAnnotationData(incompleteData)).toBe(false);
  });
});

// Test wrapper component
const TestWrapper = ({ initialValues }: { initialValues: BulkSelectionFormType }) => {
  const form = useForm<BulkSelectionFormType>({
    defaultValues: initialValues,
  });

  return (
    <FormProvider {...form}>
      <form>{getAllRowsSelectionCheckbox(form)}</form>
    </FormProvider>
  );
};

describe("getAllRowsSelectionCheckbox", () => {
  it("should render unchecked when no rows are selected", () => {
    const initialValues: BulkSelectionFormType = {
      allRows: ["row1", "row2", "row3"],
      selectedRowId: [],
      selectAll: false,
    };

    render(<TestWrapper initialValues={initialValues} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveAttribute("data-state", "unchecked");
  });

  it("should render checked when all rows are selected", () => {
    const initialValues: BulkSelectionFormType = {
      allRows: ["row1", "row2", "row3"],
      selectedRowId: ["row1", "row2", "row3"],
      selectAll: true,
    };

    render(<TestWrapper initialValues={initialValues} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
  });

  it("should render indeterminate when some rows are selected", () => {
    const initialValues: BulkSelectionFormType = {
      allRows: ["row1", "row2", "row3"],
      selectedRowId: ["row1"],
      selectAll: false,
    };

    render(<TestWrapper initialValues={initialValues} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("data-state", "indeterminate");
  });

  it("should select all rows when clicked from unchecked state", () => {
    const initialValues: BulkSelectionFormType = {
      allRows: ["row1", "row2", "row3"],
      selectedRowId: [],
      selectAll: false,
    };

    render(<TestWrapper initialValues={initialValues} />);
    const checkbox = screen.getByRole("checkbox");

    fireEvent.click(checkbox);

    // Verify checkbox is now checked
    expect(checkbox).toBeChecked();
  });

  it("should deselect all rows when clicked from checked state", () => {
    const initialValues: BulkSelectionFormType = {
      allRows: ["row1", "row2", "row3"],
      selectedRowId: ["row1", "row2", "row3"],
      selectAll: true,
    };

    render(<TestWrapper initialValues={initialValues} />);
    const checkbox = screen.getByRole("checkbox");

    fireEvent.click(checkbox);

    // Verify checkbox is now unchecked
    expect(checkbox).not.toBeChecked();
  });

  it("should handle empty allRows array", () => {
    const initialValues: BulkSelectionFormType = {
      allRows: [],
      selectedRowId: [],
      selectAll: false,
    };

    render(<TestWrapper initialValues={initialValues} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveAttribute("data-state", "unchecked");
  });
});

// Test wrapper component for getRowSelectionCheckbox
const TestRowSelectionWrapper = ({
  initialValues,
  id,
}: {
  initialValues: BulkSelectionFormType;
  id: string;
}) => {
  const form = useForm<BulkSelectionFormType>({
    defaultValues: initialValues,
  });

  return (
    <FormProvider {...form}>
      <form>
        {getRowSelectionCheckbox(form, id)}
        {/* Add a way to access form values for testing */}
        <div data-testid="selected-rows">{JSON.stringify(form.watch("selectedRowId"))}</div>
      </form>
    </FormProvider>
  );
};

describe("getRowSelectionCheckbox", () => {
  it("should render unchecked when row is not selected", () => {
    const initialValues: BulkSelectionFormType = {
      allRows: ["row1", "row2", "row3"],
      selectedRowId: ["row2"], // row1 is not selected
      selectAll: false,
    };

    render(<TestRowSelectionWrapper initialValues={initialValues} id="row1" />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveAttribute("id", "selectedRowId-row1");
    expect(checkbox).toHaveAttribute("value", "row1");
  });

  it("should render checked when row is selected", () => {
    const initialValues: BulkSelectionFormType = {
      allRows: ["row1", "row2", "row3"],
      selectedRowId: ["row1", "row3"], // row1 is selected
      selectAll: false,
    };

    render(<TestRowSelectionWrapper initialValues={initialValues} id="row1" />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
  });

  it("should add row to selection when clicked from unchecked state", () => {
    const initialValues: BulkSelectionFormType = {
      allRows: ["row1", "row2", "row3"],
      selectedRowId: ["row2"], // row1 is not selected initially
      selectAll: false,
    };

    render(<TestRowSelectionWrapper initialValues={initialValues} id="row1" />);

    const checkbox = screen.getByRole("checkbox");
    const selectedRowsDisplay = screen.getByTestId("selected-rows");

    // Initially row1 is not selected
    expect(checkbox).not.toBeChecked();
    expect(selectedRowsDisplay).toHaveTextContent('["row2"]');

    // Click to select row1
    fireEvent.click(checkbox);

    // Now row1 should be selected
    expect(checkbox).toBeChecked();
    expect(selectedRowsDisplay).toHaveTextContent('["row2","row1"]');
  });

  it("should remove row from selection when clicked from checked state", () => {
    const initialValues: BulkSelectionFormType = {
      allRows: ["row1", "row2", "row3"],
      selectedRowId: ["row1", "row2", "row3"], // row1 is selected initially
      selectAll: true,
    };

    render(<TestRowSelectionWrapper initialValues={initialValues} id="row1" />);

    const checkbox = screen.getByRole("checkbox");
    const selectedRowsDisplay = screen.getByTestId("selected-rows");

    // Initially row1 is selected
    expect(checkbox).toBeChecked();
    expect(selectedRowsDisplay).toHaveTextContent('["row1","row2","row3"]');

    // Click to deselect row1
    fireEvent.click(checkbox);

    // Now row1 should not be selected
    expect(checkbox).not.toBeChecked();
    expect(selectedRowsDisplay).toHaveTextContent('["row2","row3"]');
  });

  it("should not add duplicate row when already selected", () => {
    const initialValues: BulkSelectionFormType = {
      allRows: ["row1", "row2", "row3"],
      selectedRowId: ["row1"], // row1 is already selected
      selectAll: false,
    };

    render(<TestRowSelectionWrapper initialValues={initialValues} id="row1" />);

    const checkbox = screen.getByRole("checkbox");
    const selectedRowsDisplay = screen.getByTestId("selected-rows");

    // Initially row1 is selected
    expect(checkbox).toBeChecked();
    expect(selectedRowsDisplay).toHaveTextContent('["row1"]');

    // Uncheck and then check again
    fireEvent.click(checkbox);
    expect(selectedRowsDisplay).toHaveTextContent("[]");

    fireEvent.click(checkbox);
    expect(selectedRowsDisplay).toHaveTextContent('["row1"]');
  });

  it("should handle empty selectedRowId array", () => {
    const initialValues: BulkSelectionFormType = {
      allRows: ["row1", "row2", "row3"],
      selectedRowId: [], // empty selection
      selectAll: false,
    };

    render(<TestRowSelectionWrapper initialValues={initialValues} id="row1" />);

    const checkbox = screen.getByRole("checkbox");
    const selectedRowsDisplay = screen.getByTestId("selected-rows");

    expect(checkbox).not.toBeChecked();
    expect(selectedRowsDisplay).toHaveTextContent("[]");

    // Click to select
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(selectedRowsDisplay).toHaveTextContent('["row1"]');
  });

  it("should maintain other selections when toggling a specific row", () => {
    const initialValues: BulkSelectionFormType = {
      allRows: ["row1", "row2", "row3", "row4"],
      selectedRowId: ["row2", "row4"], // row2 and row4 are selected
      selectAll: false,
    };

    render(<TestRowSelectionWrapper initialValues={initialValues} id="row1" />);

    const checkbox = screen.getByRole("checkbox");
    const selectedRowsDisplay = screen.getByTestId("selected-rows");

    // Initially row1 is not selected, but row2 and row4 are
    expect(checkbox).not.toBeChecked();
    expect(selectedRowsDisplay).toHaveTextContent('["row2","row4"]');

    // Select row1
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(selectedRowsDisplay).toHaveTextContent('["row2","row4","row1"]');

    // Deselect row1
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(selectedRowsDisplay).toHaveTextContent('["row2","row4"]');
  });

  it("should generate correct id and name attributes", () => {
    const initialValues: BulkSelectionFormType = {
      allRows: ["test-row-123"],
      selectedRowId: [],
      selectAll: false,
    };

    render(<TestRowSelectionWrapper initialValues={initialValues} id="test-row-123" />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("id", "selectedRowId-test-row-123");
    expect(checkbox).toHaveAttribute("value", "test-row-123");
  });
});

describe("getAnnotationsColumn", () => {
  it("getAnnotationsColumn returns Annotations with correct props", () => {
    const commentRowId = {
      experimentId: "exp123",
      tableName: "tableA",
      rowId: "row42",
    };
    const comment1: Annotation = {
      id: uuidv4(),
      userId: uuidv4(),
      userName: "User One",
      type: "comment",
      content: { text: "Test comment 1" },
      createdAt: "2025-09-01T00:00:00Z",
      updatedAt: "2025-09-01T00:00:00Z",
    };
    const data = getAnnotationData([comment1]);
    const result = getAnnotationsColumn(commentRowId, data);

    expect(result).not.toBeNull();
    if (result) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result.props.experimentId).toBe("exp123");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result.props.tableName).toBe("tableA");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result.props.rowIds).toEqual(["row42"]);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result.props.data).toBe(data);
    }
  });

  it("getAnnotationsColumn returns null for invalid data", () => {
    const commentRowId = {
      experimentId: "exp123",
      tableName: "tableA",
      rowId: "row42",
    };
    const result = getAnnotationsColumn(commentRowId, { invalid: "data" });

    expect(result).toBeNull();
  });
});

describe("getTotalSelectedCounts", () => {
  function createComment(): Annotation {
    return {
      id: uuidv4(),
      userId: uuidv4(),
      userName: "User One",
      type: "comment",
      content: { text: "Test comment 1" },
      createdAt: "2025-09-01T00:00:00Z",
      updatedAt: "2025-09-01T00:00:00Z",
    };
  }

  function createFlag(): Annotation {
    return {
      id: uuidv4(),
      userId: uuidv4(),
      userName: "User Three",
      type: "flag",
      content: { flagType: "outlier", reason: "Flagged as outlier" },
      createdAt: "2025-09-03T00:00:00Z",
      updatedAt: "2025-09-03T00:00:00Z",
    };
  }

  const createMockAnnotationData = (commentCount: number, flagCount: number): AnnotationData => {
    const annotations: Annotation[] = [];
    for (let i = 0; i < commentCount; i++) {
      annotations.push(createComment());
    }
    for (let i = 0; i < flagCount; i++) {
      annotations.push(createFlag());
    }
    return getAnnotationData(annotations);
  };

  const createMockDataRow = (id: string, commentCount: number, flagCount: number): DataRow => ({
    id,
    annotations: createMockAnnotationData(commentCount, flagCount),
  });

  it("should return zero counts when tableRows is undefined", () => {
    const result = getTotalSelectedCounts(undefined, ["row1", "row2"]);
    expect(result).toEqual({ totalSelectedComments: 0, totalSelectedFlags: 0 });
  });

  it("should return zero counts when tableRows is empty", () => {
    const result = getTotalSelectedCounts([], ["row1", "row2"]);
    expect(result).toEqual({ totalSelectedComments: 0, totalSelectedFlags: 0 });
  });

  it("should return zero counts when selectedRowIds is empty", () => {
    const tableRows = [createMockDataRow("row1", 2, 1), createMockDataRow("row2", 1, 3)];
    const result = getTotalSelectedCounts(tableRows, []);
    expect(result).toEqual({ totalSelectedComments: 0, totalSelectedFlags: 0 });
  });

  it("should count annotations for selected rows only", () => {
    const tableRows = [
      createMockDataRow("row1", 2, 1), // selected
      createMockDataRow("row2", 3, 2), // not selected
      createMockDataRow("row3", 1, 4), // selected
    ];
    const selectedRowIds = ["row1", "row3"];

    const result = getTotalSelectedCounts(tableRows, selectedRowIds);
    expect(result).toEqual({ totalSelectedComments: 3, totalSelectedFlags: 5 });
  });

  it("should handle rows without annotations", () => {
    const tableRows = [
      createMockDataRow("row1", 2, 1),
      { id: "row2", annotations: null } as DataRow,
      createMockDataRow("row3", 1, 0),
    ];
    const selectedRowIds = ["row1", "row2", "row3"];

    const result = getTotalSelectedCounts(tableRows, selectedRowIds);
    expect(result).toEqual({ totalSelectedComments: 3, totalSelectedFlags: 1 });
  });

  it("should handle rows without id", () => {
    const tableRows = [
      createMockDataRow("row1", 1, 1),
      { id: null, annotations: createMockAnnotationData(5, 5) } as DataRow,
      createMockDataRow("row2", 2, 0),
    ];
    const selectedRowIds = ["row1", "row2"];

    const result = getTotalSelectedCounts(tableRows, selectedRowIds);
    expect(result).toEqual({ totalSelectedComments: 3, totalSelectedFlags: 1 });
  });

  it("should handle rows with zero comment and flag counts", () => {
    const tableRows = [
      createMockDataRow("row1", 0, 0),
      createMockDataRow("row2", 0, 2),
      createMockDataRow("row3", 3, 0),
    ];
    const selectedRowIds = ["row1", "row2", "row3"];

    const result = getTotalSelectedCounts(tableRows, selectedRowIds);
    expect(result).toEqual({ totalSelectedComments: 3, totalSelectedFlags: 2 });
  });

  it("should handle selectedRowIds that don't match any rows", () => {
    const tableRows = [createMockDataRow("row1", 2, 1), createMockDataRow("row2", 1, 3)];
    const selectedRowIds = ["nonexistent1", "nonexistent2"];

    const result = getTotalSelectedCounts(tableRows, selectedRowIds);
    expect(result).toEqual({ totalSelectedComments: 0, totalSelectedFlags: 0 });
  });
});
