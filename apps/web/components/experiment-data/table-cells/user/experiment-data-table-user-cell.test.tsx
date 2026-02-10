import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExperimentDataTableUserCell } from "./experiment-data-table-user-cell";

describe("ExperimentDataTableUserCell", () => {
  it("renders user with avatar and name", () => {
    const userData = JSON.stringify({
      id: "user-123",
      name: "John Doe",
      avatar: "https://example.com/avatar.jpg",
    });

    render(<ExperimentDataTableUserCell data={userData} columnName="User" />);

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    // Check that initials are rendered as fallback (since images don't load in tests)
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("renders user without avatar", () => {
    const userData = JSON.stringify({
      id: "user-456",
      name: "Jane Smith",
      avatar: null,
    });

    render(<ExperimentDataTableUserCell data={userData} columnName="User" />);

    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("JS")).toBeInTheDocument(); // Initials fallback
  });

  it("renders fallback for single name", () => {
    const userData = JSON.stringify({
      id: "user-789",
      name: "Madonna",
      avatar: null,
    });

    render(<ExperimentDataTableUserCell data={userData} columnName="User" />);

    expect(screen.getByText("Madonna")).toBeInTheDocument();
    expect(screen.getByText("MA")).toBeInTheDocument(); // First 2 letters for single name
  });

  it("renders user with single short name", () => {
    const userData = JSON.stringify({
      id: "user-short",
      name: "X",
      avatar: null,
    });

    render(<ExperimentDataTableUserCell data={userData} columnName="User" />);

    // "X" appears twice: once as initials, once as name
    const textElements = screen.getAllByText("X");
    expect(textElements.length).toBe(2);
  });

  it("renders nothing for empty name", () => {
    const userData = JSON.stringify({
      id: "user-empty",
      name: "",
      avatar: null,
    });

    const { container } = render(<ExperimentDataTableUserCell data={userData} columnName="User" />);

    expect(container.textContent).toBe("");
  });

  it("handles invalid JSON gracefully", () => {
    const { container } = render(
      <ExperimentDataTableUserCell data="invalid-json" columnName="User" />,
    );

    expect(container.textContent).toBe("");
  });

  it("handles invalid user object gracefully", () => {
    const invalidData = JSON.stringify({
      someOtherField: "value",
    });

    const { container } = render(
      <ExperimentDataTableUserCell data={invalidData} columnName="User" />,
    );

    expect(container.textContent).toBe("");
  });

  it("renders nothing for whitespace name", () => {
    const userData = JSON.stringify({
      id: "user-whitespace",
      name: "   ",
      avatar: null,
    });

    const { container } = render(<ExperimentDataTableUserCell data={userData} columnName="User" />);

    expect(container.textContent).toBe("");
  });

  it("renders user with multiple name parts", () => {
    const userData = JSON.stringify({
      id: "user-multiple",
      name: "John Michael Smith Jr",
      avatar: null,
    });

    render(<ExperimentDataTableUserCell data={userData} columnName="User" />);

    expect(screen.getByText("John Michael Smith Jr")).toBeInTheDocument();
    expect(screen.getByText("JJ")).toBeInTheDocument(); // First letter of first + last name parts
  });

  it("handles parsed data that is not an object", () => {
    const notAnObject = JSON.stringify("just a string");

    const { container } = render(
      <ExperimentDataTableUserCell data={notAnObject} columnName="User" />,
    );

    expect(container.textContent).toBe("");
  });

  it("handles null parsed data", () => {
    const nullData = JSON.stringify(null);

    const { container } = render(<ExperimentDataTableUserCell data={nullData} columnName="User" />);

    expect(container.textContent).toBe("");
  });

  it("handles parsed data that is an array", () => {
    const arrayData = JSON.stringify([{ id: "1", name: "Test", avatar: null }]);

    const { container } = render(
      <ExperimentDataTableUserCell data={arrayData} columnName="User" />,
    );

    expect(container.textContent).toBe("");
  });

  it("handles parsed data missing required fields", () => {
    const missingId = JSON.stringify({
      name: "John Doe",
      avatar: null,
    });

    const { container } = render(
      <ExperimentDataTableUserCell data={missingId} columnName="User" />,
    );

    expect(container.textContent).toBe("");
  });

  it("handles user with null name", () => {
    const userData = JSON.stringify({
      id: "user-null-name",
      name: null,
      avatar: null,
    });

    const { container } = render(<ExperimentDataTableUserCell data={userData} columnName="User" />);

    expect(container.textContent).toBe("");
  });

  it("handles exception during JSON parsing", () => {
    // Create a string that will cause JSON.parse to throw
    const malformedJSON = "{invalid json structure";

    const { container } = render(
      <ExperimentDataTableUserCell data={malformedJSON} columnName="User" />,
    );

    expect(container.textContent).toBe("");
  });

  it("handles JSON parsing exception with nested try-catch", () => {
    // Another malformed JSON to ensure catch block is covered
    const badJSON = "{ unclosed object";

    const { container } = render(<ExperimentDataTableUserCell data={badJSON} columnName="User" />);

    expect(container.textContent).toBe("");
  });

  it("renders user with avatar URL", () => {
    const userData = JSON.stringify({
      id: "user-with-image",
      name: "Alice Johnson",
      avatar: "https://example.com/alice.jpg",
    });

    render(<ExperimentDataTableUserCell data={userData} columnName="User" />);

    expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    // In test environment, images don't load so fallback initials are shown
    expect(screen.getByText("AJ")).toBeInTheDocument();
  });
});
