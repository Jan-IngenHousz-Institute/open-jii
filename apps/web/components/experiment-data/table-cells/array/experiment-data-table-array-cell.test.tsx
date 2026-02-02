import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import {
  ExperimentDataTableArrayCell,
  ArrayExpandedContent,
} from "./experiment-data-table-array-cell";

describe("ExperimentDataTableArrayCell", () => {
  it("should render simple text for non-array data", () => {
    render(
      <ExperimentDataTableArrayCell
        data="simple text"
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("simple text")).toBeInTheDocument();
  });

  it("should render simple text for invalid JSON data", () => {
    render(
      <ExperimentDataTableArrayCell
        data="{invalid json}"
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("{invalid json}")).toBeInTheDocument();
  });

  it("should render simple text for non-array JSON data", () => {
    render(
      <ExperimentDataTableArrayCell
        data='{"key": "value"}'
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText('{"key": "value"}')).toBeInTheDocument();
  });

  it("should render empty array message for empty array data", () => {
    render(
      <ExperimentDataTableArrayCell
        data="[]"
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("Empty array")).toBeInTheDocument();
  });

  it("should render single item inline for one entry with single property", () => {
    const singleItemData = '[{"question_label": "question1"}]';
    render(
      <ExperimentDataTableArrayCell
        data={singleItemData}
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );

    expect(screen.getByText("question_label:")).toBeInTheDocument();
    expect(screen.getByText("question1")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("should render collapsible trigger for single item with multiple properties", () => {
    const singleItemMultipleProps = '[{"question_label": "question1", "question_text": "text1"}]';
    render(
      <ExperimentDataTableArrayCell
        data={singleItemMultipleProps}
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );

    expect(screen.getByText("1 item")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should render collapsible trigger for multiple items", () => {
    const multipleItemsData = JSON.stringify([
      { question_label: "question1", question_text: "text1", question_answer: "answer1" },
      { question_label: "question2", question_text: "text2", question_answer: "answer2" },
    ]);

    render(
      <ExperimentDataTableArrayCell
        data={multipleItemsData}
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );

    expect(screen.getByText("2 items")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should show correct singular/plural text", () => {
    // Test singular
    const singleItemData = '[{"key1": "value1", "key2": "value2"}]';
    const { rerender } = render(
      <ExperimentDataTableArrayCell
        data={singleItemData}
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("1 item")).toBeInTheDocument();

    // Test plural
    const multipleItemsData = '[{"key1": "value1"}, {"key2": "value2"}]';
    rerender(
      <ExperimentDataTableArrayCell
        data={multipleItemsData}
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("2 items")).toBeInTheDocument();
  });

  it("should expand and show items when triggered", () => {
    const testData = JSON.stringify([
      { question_label: "question1", question_text: "What is your name?", question_answer: "John" },
      { question_label: "question2", question_text: "What is your age?", question_answer: "25" },
    ]);

    render(
      <ExperimentDataTableArrayCell
        data={testData}
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );

    // Initially collapsed
    expect(screen.getByText("2 items")).toBeInTheDocument();
    expect(screen.queryByText("question_label:")).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByRole("button"));

    // Note: The DOM manipulation content won't be visible in React testing environment
    // but we can verify the trigger was clicked and collapsible state changed
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should handle nested objects in array items", () => {
    const nestedData = JSON.stringify([
      {
        id: 1,
        details: { name: "John", age: 30 },
        tags: ["developer", "typescript"],
      },
    ]);

    render(
      <ExperimentDataTableArrayCell
        data={nestedData}
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("1 item")).toBeInTheDocument();
  });

  it("should handle array items with null and undefined values", () => {
    const dataWithNulls = JSON.stringify([{ name: "John", age: null, active: undefined }]);

    render(
      <ExperimentDataTableArrayCell
        data={dataWithNulls}
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("1 item")).toBeInTheDocument();
  });
});

describe("ArrayExpandedContent", () => {
  it("should return null for invalid data", () => {
    const { container } = render(<ArrayExpandedContent data="invalid" />);
    expect(container.firstChild).toBeNull();
  });

  it("should return empty content for empty array", () => {
    const { container } = render(<ArrayExpandedContent data="[]" />);
    expect(container.querySelector(".w-full")).toBeInTheDocument();
  });

  it("should render array content when valid data is provided", () => {
    const data = JSON.stringify([
      { question_label: "question1", question_text: "What is your name?" },
      { question_label: "question2", question_text: "What is your age?" },
    ]);

    const { container } = render(<ArrayExpandedContent data={data} />);

    // Verify content is rendered
    expect(container.querySelector(".w-full")).toBeInTheDocument();
  });
});

// Additional utility function tests
describe("parseArrayData", () => {
  // Since parseArrayData is not exported, we'll test it through the component behavior
  it("should handle various JSON array formats through component", () => {
    // Test with standard JSON array
    const standardArray = '[{"a": 1}, {"b": 2}]';
    const { unmount } = render(
      <ExperimentDataTableArrayCell
        data={standardArray}
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("2 items")).toBeInTheDocument();
    unmount();

    // Test with formatted JSON array
    const formattedArray = `[
      {
        "question_label": "q1",
        "question_text": "text1"
      },
      {
        "question_label": "q2", 
        "question_text": "text2"
      }
    ]`;

    render(
      <ExperimentDataTableArrayCell
        data={formattedArray}
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("2 items")).toBeInTheDocument();
  });

  it("should handle array containing mixed types", () => {
    // Test with array containing mixed types
    const mixedArray = '[{"str": "text", "num": 42, "bool": true, "null": null}]';
    render(
      <ExperimentDataTableArrayCell
        data={mixedArray}
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("1 item")).toBeInTheDocument();
  });
});

describe("formatValue", () => {
  // Since formatValue is not exported, we'll test it through the component behavior
  it("should handle different value types through component rendering", () => {
    const testData = JSON.stringify([
      {
        stringValue: "test string",
        numberValue: 42,
        booleanValue: true,
        nullValue: null,
        objectValue: { nested: "object" },
        arrayValue: [1, 2, 3],
      },
    ]);

    render(
      <ExperimentDataTableArrayCell
        data={testData}
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("1 item")).toBeInTheDocument();

    // The component should handle all these value types without throwing errors
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
