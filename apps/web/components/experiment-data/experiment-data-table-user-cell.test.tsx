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

  it("renders user without image", () => {
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

    expect(screen.getByText("Invalid user data")).toBeInTheDocument();
  });

  it("handles invalid user object gracefully", () => {
    const invalidData = JSON.stringify({
      someOtherField: "value",
    });

    render(<ExperimentDataTableUserCell data={invalidData} columnName="User" />);

    expect(screen.getByText("Invalid user data")).toBeInTheDocument();
  });
});
