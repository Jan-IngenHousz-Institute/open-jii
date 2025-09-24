import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { LocationSearch } from "./location-search";

const mockSearchResults = [
  {
    label: "Berlin, Germany",
    latitude: 52.52,
    longitude: 13.405,
    country: "Germany",
    region: "Berlin",
    municipality: "Berlin",
  },
  {
    label: "Berlin, NH, USA",
    latitude: 44.4687,
    longitude: -71.1853,
    country: "United States",
    region: "New Hampshire",
    municipality: "Berlin",
  },
];

describe("LocationSearch", () => {
  const mockOnLocationSelect = vi.fn();
  const mockOnSearch = vi.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with default placeholder", () => {
    render(<LocationSearch onLocationSelect={mockOnLocationSelect} />);

    expect(screen.getByPlaceholderText("Search for locations...")).toBeInTheDocument();
  });

  it("renders with custom placeholder", () => {
    render(
      <LocationSearch onLocationSelect={mockOnLocationSelect} placeholder="Find a place..." />,
    );

    expect(screen.getByPlaceholderText("Find a place...")).toBeInTheDocument();
  });

  it("calls onSearch when typing", async () => {
    render(<LocationSearch onLocationSelect={mockOnLocationSelect} onSearch={mockOnSearch} />);

    const input = screen.getByPlaceholderText("Search for locations...");
    await user.type(input, "Berlin");

    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenLastCalledWith("Berlin");
    });
  });

  it("shows loading state when searchLoading is true", () => {
    const { container } = render(
      <LocationSearch onLocationSelect={mockOnLocationSelect} searchLoading={true} />,
    );

    // Check for loading spinner in the input - should be the first animate-spin element
    const loadingSpinner = container.querySelector(".animate-spin");
    expect(loadingSpinner).toBeInTheDocument();
    expect(loadingSpinner).toHaveClass("animate-spin");
  });

  it("shows search results when query is 3+ characters", async () => {
    render(
      <LocationSearch onLocationSelect={mockOnLocationSelect} searchResults={mockSearchResults} />,
    );

    const input = screen.getByPlaceholderText("Search for locations...");
    await user.type(input, "Ber");

    await waitFor(() => {
      expect(screen.getByText("Berlin, Germany")).toBeInTheDocument();
      expect(screen.getByText("Berlin, NH, USA")).toBeInTheDocument();
    });
  });

  it("does not show results dropdown when query is less than 3 characters", async () => {
    render(
      <LocationSearch onLocationSelect={mockOnLocationSelect} searchResults={mockSearchResults} />,
    );

    const input = screen.getByPlaceholderText("Search for locations...");
    await user.type(input, "Be");

    // Results should not be visible
    expect(screen.queryByText("Berlin, Germany")).not.toBeInTheDocument();
  });

  it("calls onLocationSelect when a result is clicked", async () => {
    render(
      <LocationSearch onLocationSelect={mockOnLocationSelect} searchResults={mockSearchResults} />,
    );

    const input = screen.getByPlaceholderText("Search for locations...");
    await user.type(input, "Berlin");

    await waitFor(() => {
      expect(screen.getByText("Berlin, Germany")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Berlin, Germany"));

    expect(mockOnLocationSelect).toHaveBeenCalledWith(mockSearchResults[0]);
  });

  it("updates input value when location is selected", async () => {
    render(
      <LocationSearch onLocationSelect={mockOnLocationSelect} searchResults={mockSearchResults} />,
    );

    const input = screen.getByPlaceholderText("Search for locations...");
    await user.type(input, "Berlin");

    await waitFor(() => {
      expect(screen.getByText("Berlin, Germany")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Berlin, Germany"));

    expect(input).toHaveValue("Berlin, Germany");
  });

  it("supports keyboard navigation", async () => {
    render(
      <LocationSearch onLocationSelect={mockOnLocationSelect} searchResults={mockSearchResults} />,
    );

    const input = screen.getByPlaceholderText("Search for locations...");
    await user.type(input, "Berlin");

    await waitFor(() => {
      expect(screen.getByText("Berlin, Germany")).toBeInTheDocument();
    });

    // Arrow down to select first item
    fireEvent.keyDown(input, { key: "ArrowDown" });

    // First item should be highlighted
    const firstResult = screen.getByText("Berlin, Germany").closest("button");
    expect(firstResult).toHaveClass("bg-blue-50");

    // Arrow down to select second item
    fireEvent.keyDown(input, { key: "ArrowDown" });

    // Second item should be highlighted
    const secondResult = screen.getByText("Berlin, NH, USA").closest("button");
    expect(secondResult).toHaveClass("bg-blue-50");

    // Arrow up to go back to first item
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(firstResult).toHaveClass("bg-blue-50");
  });

  it("selects highlighted item with Enter key", async () => {
    render(
      <LocationSearch onLocationSelect={mockOnLocationSelect} searchResults={mockSearchResults} />,
    );

    const input = screen.getByPlaceholderText("Search for locations...");
    await user.type(input, "Berlin");

    await waitFor(() => {
      expect(screen.getByText("Berlin, Germany")).toBeInTheDocument();
    });

    // Navigate to first item and press Enter
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockOnLocationSelect).toHaveBeenCalledWith(mockSearchResults[0]);
  });

  it("closes dropdown with Escape key", async () => {
    render(
      <LocationSearch onLocationSelect={mockOnLocationSelect} searchResults={mockSearchResults} />,
    );

    const input = screen.getByPlaceholderText("Search for locations...");
    await user.type(input, "Berlin");

    await waitFor(() => {
      expect(screen.getByText("Berlin, Germany")).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByText("Berlin, Germany")).not.toBeInTheDocument();
    });
  });

  it("shows loading state in dropdown", async () => {
    render(<LocationSearch onLocationSelect={mockOnLocationSelect} searchLoading={true} />);

    const input = screen.getByPlaceholderText("Search for locations...");
    await user.type(input, "Berlin");

    await waitFor(() => {
      expect(screen.getByText("Searching...")).toBeInTheDocument();
    });
  });

  it("shows no results message when no results found", async () => {
    render(<LocationSearch onLocationSelect={mockOnLocationSelect} searchResults={[]} />);

    const input = screen.getByPlaceholderText("Search for locations...");
    await user.type(input, "Unknown Place");

    await waitFor(() => {
      expect(screen.getByText('No locations found for "Unknown Place"')).toBeInTheDocument();
    });
  });

  it("can be disabled", () => {
    render(<LocationSearch onLocationSelect={mockOnLocationSelect} disabled={true} />);

    const input = screen.getByPlaceholderText("Search for locations...");
    expect(input).toBeDisabled();
    expect(input).toHaveClass("disabled:bg-gray-50", "disabled:text-gray-500");
  });

  it("applies custom className", () => {
    const { container } = render(
      <LocationSearch onLocationSelect={mockOnLocationSelect} className="custom-class" />,
    );

    // The custom class should be on the outermost div
    const outerDiv = container.firstChild;
    expect(outerDiv).toHaveClass("custom-class");
  });

  it("displays location details correctly", async () => {
    render(
      <LocationSearch onLocationSelect={mockOnLocationSelect} searchResults={mockSearchResults} />,
    );

    const input = screen.getByPlaceholderText("Search for locations...");
    await user.type(input, "Berlin");

    await waitFor(() => {
      // Check main label
      expect(screen.getByText("Berlin, Germany")).toBeInTheDocument();
      expect(screen.getByText("Berlin, NH, USA")).toBeInTheDocument();

      // Check location details (municipality, region, country)
      expect(screen.getByText("Berlin, Berlin, Germany")).toBeInTheDocument();
      expect(screen.getByText("Berlin, New Hampshire, United States")).toBeInTheDocument();

      // Check coordinates
      expect(screen.getByText("52.5200, 13.4050")).toBeInTheDocument();
      expect(screen.getByText("44.4687, -71.1853")).toBeInTheDocument();
    });
  });

  it("highlights item on mouse enter", async () => {
    render(
      <LocationSearch onLocationSelect={mockOnLocationSelect} searchResults={mockSearchResults} />,
    );

    const input = screen.getByPlaceholderText("Search for locations...");
    await user.type(input, "Berlin");

    await waitFor(() => {
      expect(screen.getByText("Berlin, Germany")).toBeInTheDocument();
    });

    const firstResult = screen.getByText("Berlin, Germany").closest("button");
    if (firstResult) {
      fireEvent.mouseEnter(firstResult);
      expect(firstResult).toHaveClass("bg-blue-50");
    }
  });

  it("closes dropdown on blur with delay", async () => {
    render(
      <LocationSearch onLocationSelect={mockOnLocationSelect} searchResults={mockSearchResults} />,
    );

    const input = screen.getByPlaceholderText("Search for locations...");
    await user.type(input, "Berlin");

    await waitFor(() => {
      expect(screen.getByText("Berlin, Germany")).toBeInTheDocument();
    });

    fireEvent.blur(input);

    // Should still be visible immediately
    expect(screen.getByText("Berlin, Germany")).toBeInTheDocument();

    // Should close after delay
    await waitFor(
      () => {
        expect(screen.queryByText("Berlin, Germany")).not.toBeInTheDocument();
      },
      { timeout: 300 },
    );
  });
});
