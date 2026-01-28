import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExperimentDataTableUserCell } from "./experiment-data-table-user-cell";

describe("ExperimentDataTableUserCell", () => {
  it("renders user with avatar and name", () => {
    const userData = JSON.stringify({
      id: "user-123",
      name: "John Doe",
      image: "https://example.com/avatar.jpg",
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
      image: null,
    });

    render(<ExperimentDataTableUserCell data={userData} columnName="User" />);

    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("JS")).toBeInTheDocument(); // Initials fallback
  });

  it("renders fallback for single name", () => {
    const userData = JSON.stringify({
      id: "user-789",
      name: "Madonna",
      image: null,
    });

    render(<ExperimentDataTableUserCell data={userData} columnName="User" />);

    expect(screen.getByText("Madonna")).toBeInTheDocument();
    expect(screen.getByText("MA")).toBeInTheDocument(); // First 2 letters for single name
  });

  it("renders user with single short name", () => {
    const userData = JSON.stringify({
      id: "user-short",
      name: "X",
      image: null,
    });

    render(<ExperimentDataTableUserCell data={userData} columnName="User" />);

    // "X" appears twice: once as initials, once as name
    const textElements = screen.getAllByText("X");
    expect(textElements.length).toBe(2);
  });

  it("renders fallback for empty name", () => {
    const userData = JSON.stringify({
      id: "user-empty",
      name: "",
      image: null,
    });

    render(<ExperimentDataTableUserCell data={userData} columnName="User" />);

    expect(screen.getByText("Unknown User")).toBeInTheDocument();
    expect(screen.getByText("U")).toBeInTheDocument(); // Default fallback
  });

  it("handles invalid JSON gracefully", () => {
    render(<ExperimentDataTableUserCell data="invalid-json" columnName="User" />);

    expect(screen.getByText("Unknown User")).toBeInTheDocument();
  });

  it("handles invalid user object gracefully", () => {
    const invalidData = JSON.stringify({
      someOtherField: "value",
    });

    render(<ExperimentDataTableUserCell data={invalidData} columnName="User" />);

    expect(screen.getByText("Unknown User")).toBeInTheDocument();
  });

  it("renders user with whitespace name", () => {
    const userData = JSON.stringify({
      id: "user-whitespace",
      name: "   ",
      image: null,
    });

    render(<ExperimentDataTableUserCell data={userData} columnName="User" />);

    // The component renders the whitespace but getInitials returns "U" for empty trimmed string
    expect(screen.getByText("U")).toBeInTheDocument(); // Default fallback for empty/whitespace
    // The name span will contain whitespace, not "Unknown User" text
  });

  it("renders user with multiple name parts", () => {
    const userData = JSON.stringify({
      id: "user-multiple",
      name: "John Michael Smith Jr",
      image: null,
    });

    render(<ExperimentDataTableUserCell data={userData} columnName="User" />);

    expect(screen.getByText("John Michael Smith Jr")).toBeInTheDocument();
    expect(screen.getByText("JJ")).toBeInTheDocument(); // First letter of first + last name parts
  });

  it("handles parsed data that is not an object", () => {
    const notAnObject = JSON.stringify("just a string");

    render(<ExperimentDataTableUserCell data={notAnObject} columnName="User" />);

    expect(screen.getByText("Unknown User")).toBeInTheDocument();
    expect(screen.getByText("U")).toBeInTheDocument();
  });

  it("handles null parsed data", () => {
    const nullData = JSON.stringify(null);

    render(<ExperimentDataTableUserCell data={nullData} columnName="User" />);

    expect(screen.getByText("Unknown User")).toBeInTheDocument();
    expect(screen.getByText("U")).toBeInTheDocument();
  });

  it("handles parsed data that is an array", () => {
    const arrayData = JSON.stringify([{ id: "1", name: "Test", image: null }]);

    render(<ExperimentDataTableUserCell data={arrayData} columnName="User" />);

    expect(screen.getByText("Unknown User")).toBeInTheDocument();
  });

  it("handles parsed data missing required fields", () => {
    const missingId = JSON.stringify({
      name: "John Doe",
      image: null,
    });

    render(<ExperimentDataTableUserCell data={missingId} columnName="User" />);

    expect(screen.getByText("Unknown User")).toBeInTheDocument();
  });

  it("handles user with null name", () => {
    const userData = JSON.stringify({
      id: "user-null-name",
      name: null,
      image: null,
    });

    render(<ExperimentDataTableUserCell data={userData} columnName="User" />);

    // Should show "Unknown User" when name is null
    expect(screen.getByText("Unknown User")).toBeInTheDocument();
  });

  it("handles exception during JSON parsing", () => {
    // Create a string that will cause JSON.parse to throw
    const malformedJSON = "{invalid json structure";

    render(<ExperimentDataTableUserCell data={malformedJSON} columnName="User" />);

    expect(screen.getByText("Unknown User")).toBeInTheDocument();
    expect(screen.getByText("U")).toBeInTheDocument();
  });

  it("handles JSON parsing exception with nested try-catch", () => {
    // Another malformed JSON to ensure catch block is covered
    const badJSON = "{ unclosed object";

    render(<ExperimentDataTableUserCell data={badJSON} columnName="User" />);

    const unknownUserElements = screen.getAllByText("Unknown User");
    expect(unknownUserElements.length).toBeGreaterThan(0);
  });

  it("renders user with avatar URL", () => {
    const userData = JSON.stringify({
      id: "user-with-image",
      name: "Alice Johnson",
      image: "https://example.com/alice.jpg",
    });

    render(<ExperimentDataTableUserCell data={userData} columnName="User" />);

    expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    // In test environment, images don't load so fallback initials are shown
    expect(screen.getByText("AJ")).toBeInTheDocument();
  });
});
