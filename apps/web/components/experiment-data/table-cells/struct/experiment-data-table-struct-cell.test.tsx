import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import {
  ExperimentDataTableStructCell,
  StructExpandedContent,
} from "./experiment-data-table-struct-cell";

describe("ExperimentDataTableStructCell", () => {
  it("should render simple text for non-struct data", () => {
    render(
      <ExperimentDataTableStructCell
        data="simple text"
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("simple text")).toBeInTheDocument();
  });

  it("should render simple text for invalid JSON", () => {
    render(
      <ExperimentDataTableStructCell
        data="{invalid json}"
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("{invalid json}")).toBeInTheDocument();
  });

  it("should render field count for valid struct", () => {
    render(
      <ExperimentDataTableStructCell
        data='{"name": "John", "age": 30}'
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("2 fields")).toBeInTheDocument();
  });

  it("should render singular 'field' for single field struct", () => {
    render(
      <ExperimentDataTableStructCell
        data='{"name": "John"}'
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("1 field")).toBeInTheDocument();
  });

  it("should render array as text (not a struct)", () => {
    render(
      <ExperimentDataTableStructCell
        data='[{"name": "John"}]'
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText('[{"name": "John"}]')).toBeInTheDocument();
  });

  it("should render collapsed state with button", () => {
    render(
      <ExperimentDataTableStructCell
        data='{"name": "John"}'
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByText("1 field")).toBeInTheDocument();
  });

  it("should render expanded state with button", () => {
    render(
      <ExperimentDataTableStructCell
        data='{"name": "John"}'
        columnName="test"
        rowId="test-row"
        isExpanded={true}
      />,
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByText("1 field")).toBeInTheDocument();
  });

  it("should call onToggleExpansion when clicked", async () => {
    const user = userEvent.setup();
    const onToggleExpansion = vi.fn();
    render(
      <ExperimentDataTableStructCell
        data='{"name": "John"}'
        columnName="test-col"
        rowId="test-row"
        isExpanded={false}
        onToggleExpansion={onToggleExpansion}
      />,
    );

    await user.click(screen.getByRole("button"));

    expect(onToggleExpansion).toHaveBeenCalledWith("test-row", "test-col");
  });

  it("should handle null values in struct", () => {
    render(
      <ExperimentDataTableStructCell
        data='{"name": null, "age": 30}'
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("2 fields")).toBeInTheDocument();
  });

  it("should handle nested objects", () => {
    render(
      <ExperimentDataTableStructCell
        data='{"user": {"name": "John", "age": 30}}'
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("1 field")).toBeInTheDocument();
  });

  it("should handle empty struct", () => {
    render(
      <ExperimentDataTableStructCell
        data="{}"
        columnName="test"
        rowId="test-row"
        isExpanded={false}
      />,
    );
    expect(screen.getByText("0 fields")).toBeInTheDocument();
  });
});

describe("StructExpandedContent", () => {
  it("should render null for invalid JSON", () => {
    const { container } = render(<StructExpandedContent data="invalid" />);
    expect(container.firstChild).toBeNull();
  });

  it("should render null for array data", () => {
    const { container } = render(<StructExpandedContent data='[{"name": "John"}]' />);
    expect(container.firstChild).toBeNull();
  });

  it("should render struct fields", () => {
    render(<StructExpandedContent data='{"name": "John", "age": 30, "active": true}' />);

    expect(screen.getByText("name:")).toBeInTheDocument();
    expect(screen.getByText("John")).toBeInTheDocument();
    expect(screen.getByText("age:")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("active:")).toBeInTheDocument();
    expect(screen.getByText("true")).toBeInTheDocument();
  });

  it("should handle null values", () => {
    render(<StructExpandedContent data='{"name": "John", "value": null}' />);

    expect(screen.getByText("name:")).toBeInTheDocument();
    expect(screen.getByText("John")).toBeInTheDocument();
    expect(screen.getByText("value:")).toBeInTheDocument();
    expect(screen.getByText("null")).toBeInTheDocument();
  });

  it("should stringify object values", () => {
    render(<StructExpandedContent data='{"user": {"name": "John", "age": 30}}' />);

    expect(screen.getByText("user:")).toBeInTheDocument();
    expect(screen.getByText('{"name":"John","age":30}')).toBeInTheDocument();
  });

  it("should handle empty struct", () => {
    const { container } = render(<StructExpandedContent data="{}" />);
    expect(container.querySelector(".w-full")).toBeInTheDocument();
  });
});
