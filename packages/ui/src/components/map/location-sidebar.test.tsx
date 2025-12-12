import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { LocationSidebar, LocationSidebarEntry } from "./location-sidebar";

const mockLocation1 = {
  id: "1",
  name: "Berlin Office",
  latitude: 52.52,
  longitude: 13.405,
  country: "Germany",
  region: "Berlin",
  municipality: "Berlin",
  postalCode: "10115",
  distance: 0.5,
};

const mockLocation2 = {
  id: "2",
  name: "Munich Headquarters",
  latitude: 48.1351,
  longitude: 11.582,
  country: "Germany",
  region: "Bavaria",
  municipality: "Munich",
  postalCode: "80331",
  distance: 2.3,
};

const mockLocations = [mockLocation1, mockLocation2];

// Mock window.open
const mockWindowOpen = vi.fn();
Object.defineProperty(window, "open", {
  value: mockWindowOpen,
  writable: true,
});

describe("LocationSidebarEntry", () => {
  const mockOnClick = vi.fn();
  const mockOnNavigate = vi.fn();
  const mockOnRemove = vi.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders location information correctly", () => {
    render(<LocationSidebarEntry location={mockLocation1} onClick={mockOnClick} />);

    expect(screen.getByText("Berlin Office")).toBeInTheDocument();
    expect(screen.getByText("Berlin, Berlin")).toBeInTheDocument();
    expect(screen.getByText("Germany")).toBeInTheDocument();
    expect(screen.getByText("10115")).toBeInTheDocument();
    expect(screen.getByText("52.5200°N, 13.4050°E")).toBeInTheDocument();
  });

  it("shows selected state styling", () => {
    render(
      <LocationSidebarEntry location={mockLocation1} isSelected={true} onClick={mockOnClick} />,
    );

    // Get the main container div (outermost div with the styling)
    const container = screen.getByText("Berlin Office").closest('[class*="border"]');
    expect(container).toHaveClass("border-jii-dark-green", "bg-jii-dark-green/10");
  });

  it("shows default state styling when not selected", () => {
    render(
      <LocationSidebarEntry location={mockLocation1} isSelected={false} onClick={mockOnClick} />,
    );

    // Get the main container div (outermost div with the styling)
    const container = screen.getByText("Berlin Office").closest('[class*="border"]');
    expect(container).toHaveClass("border-gray-200", "bg-white");
  });

  it("calls onClick when clicked", async () => {
    render(<LocationSidebarEntry location={mockLocation1} onClick={mockOnClick} />);

    await user.click(screen.getByText("Berlin Office"));
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it("shows distance when showDistance is true", () => {
    render(
      <LocationSidebarEntry location={mockLocation1} showDistance={true} onClick={mockOnClick} />,
    );

    expect(screen.getByText("500m")).toBeInTheDocument();
  });

  it("formats distance correctly for distances less than 1km", () => {
    const locationWithSmallDistance = {
      ...mockLocation1,
      distance: 0.25,
    };

    render(
      <LocationSidebarEntry
        location={locationWithSmallDistance}
        showDistance={true}
        onClick={mockOnClick}
      />,
    );

    expect(screen.getByText("250m")).toBeInTheDocument();
  });

  it("shows remove button in selection mode", () => {
    render(
      <LocationSidebarEntry
        location={mockLocation1}
        selectionMode={true}
        onRemove={mockOnRemove}
        onClick={mockOnClick}
      />,
    );

    const removeButton = screen.getByTitle("Remove location");
    expect(removeButton).toBeInTheDocument();
  });

  it("calls onRemove when remove button is clicked", async () => {
    render(
      <LocationSidebarEntry
        location={mockLocation1}
        selectionMode={true}
        onRemove={mockOnRemove}
        onClick={mockOnClick}
      />,
    );

    const removeButton = screen.getByTitle("Remove location");
    await user.click(removeButton);

    expect(mockOnRemove).toHaveBeenCalledTimes(1);
    expect(mockOnClick).not.toHaveBeenCalled(); // Should not trigger parent click
  });

  it("shows navigate button when not in selection mode", () => {
    render(
      <LocationSidebarEntry
        location={mockLocation1}
        selectionMode={false}
        onNavigate={mockOnNavigate}
        onClick={mockOnClick}
      />,
    );

    const navigateButton = screen.getByTitle("Navigate to location");
    expect(navigateButton).toBeInTheDocument();
  });

  it("calls onNavigate when navigate button is clicked", async () => {
    render(
      <LocationSidebarEntry
        location={mockLocation1}
        selectionMode={false}
        onNavigate={mockOnNavigate}
        onClick={mockOnClick}
      />,
    );

    const navigateButton = screen.getByTitle("Navigate to location");
    await user.click(navigateButton);

    expect(mockOnNavigate).toHaveBeenCalledTimes(1);
    expect(mockOnClick).not.toHaveBeenCalled(); // Should not trigger parent click
  });

  it("opens Google Maps when external link button is clicked", async () => {
    render(<LocationSidebarEntry location={mockLocation1} onClick={mockOnClick} />);

    const mapsButton = screen.getByTitle("Open in Google Maps");
    await user.click(mapsButton);

    expect(mockWindowOpen).toHaveBeenCalledWith(
      "https://www.google.com/maps/search/?api=1&query=52.52,13.405",
      "_blank",
    );
    expect(mockOnClick).not.toHaveBeenCalled(); // Should not trigger parent click
  });

  it("handles location without optional fields", () => {
    const minimalLocation = {
      name: "Simple Location",
      latitude: 50.0,
      longitude: 10.0,
    };

    render(<LocationSidebarEntry location={minimalLocation} onClick={mockOnClick} />);

    expect(screen.getByText("Simple Location")).toBeInTheDocument();
    expect(screen.getByText("50.0000°N, 10.0000°E")).toBeInTheDocument();
    expect(screen.queryByText("Germany")).not.toBeInTheDocument();
  });

  it("handles negative coordinates correctly", () => {
    const locationWithNegativeCoords = {
      name: "Southern Location",
      latitude: -33.8688,
      longitude: -151.2093,
    };

    render(<LocationSidebarEntry location={locationWithNegativeCoords} onClick={mockOnClick} />);

    expect(screen.getByText("33.8688°S, 151.2093°W")).toBeInTheDocument();
  });
});

describe("LocationSidebar", () => {
  const mockOnLocationSelect = vi.fn();
  const mockOnLocationNavigate = vi.fn();
  const mockOnLocationRemove = vi.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders list of locations", () => {
    render(<LocationSidebar locations={mockLocations} onLocationSelect={mockOnLocationSelect} />);

    expect(screen.getByText("Berlin Office")).toBeInTheDocument();
    expect(screen.getByText("Munich Headquarters")).toBeInTheDocument();
  });

  it("shows empty state when no locations", () => {
    render(<LocationSidebar locations={[]} onLocationSelect={mockOnLocationSelect} />);

    expect(screen.getByText("No locations to display")).toBeInTheDocument();
  });

  it("marks selected location correctly", () => {
    render(
      <LocationSidebar
        locations={mockLocations}
        selectedLocation={mockLocation1}
        onLocationSelect={mockOnLocationSelect}
      />,
    );

    const selectedEntry = screen.getByText("Berlin Office").closest('[class*="border"]');
    expect(selectedEntry).toHaveClass("border-jii-dark-green", "bg-jii-dark-green/10");

    const unselectedEntry = screen.getByText("Munich Headquarters").closest('[class*="border"]');
    expect(unselectedEntry).toHaveClass("border-gray-200", "bg-white");
  });

  it("calls onLocationSelect when location is clicked", async () => {
    render(<LocationSidebar locations={mockLocations} onLocationSelect={mockOnLocationSelect} />);

    await user.click(screen.getByText("Berlin Office"));
    expect(mockOnLocationSelect).toHaveBeenCalledWith(mockLocation1);
  });

  it("shows distances when showDistances is true", () => {
    render(
      <LocationSidebar
        locations={mockLocations}
        showDistances={true}
        onLocationSelect={mockOnLocationSelect}
      />,
    );

    expect(screen.getByText("500m")).toBeInTheDocument();
    expect(screen.getByText("2.3km")).toBeInTheDocument();
  });

  it("passes selection mode to entries", () => {
    render(
      <LocationSidebar
        locations={mockLocations}
        selectionMode={true}
        onLocationRemove={mockOnLocationRemove}
        onLocationSelect={mockOnLocationSelect}
      />,
    );

    expect(screen.getAllByTitle("Remove location")).toHaveLength(2);
  });

  it("calls onLocationNavigate when navigate button is clicked", async () => {
    render(
      <LocationSidebar
        locations={mockLocations}
        selectionMode={false}
        onLocationNavigate={mockOnLocationNavigate}
        onLocationSelect={mockOnLocationSelect}
      />,
    );

    const navigateButtons = screen.getAllByTitle("Navigate to location");
    expect(navigateButtons[0]).toBeDefined();
    await user.click(navigateButtons[0]!);

    expect(mockOnLocationNavigate).toHaveBeenCalledWith(mockLocation1);
  });

  it("calls onLocationRemove when remove button is clicked", async () => {
    render(
      <LocationSidebar
        locations={mockLocations}
        selectionMode={true}
        onLocationRemove={mockOnLocationRemove}
        onLocationSelect={mockOnLocationSelect}
      />,
    );

    const removeButtons = screen.getAllByTitle("Remove location");
    expect(removeButtons[0]).toBeDefined();
    await user.click(removeButtons[0]!);

    expect(mockOnLocationRemove).toHaveBeenCalledWith(mockLocation1);
  });

  it("applies custom className", () => {
    const { container } = render(
      <LocationSidebar
        locations={mockLocations}
        className="custom-sidebar-class"
        onLocationSelect={mockOnLocationSelect}
      />,
    );

    const sidebar = container.firstChild;
    expect(sidebar).toHaveClass("custom-sidebar-class");
  });

  it("handles location selection correctly with coordinates matching", () => {
    const selectedLocation = {
      ...mockLocation1,
      id: "different-id", // Different ID but same coordinates
    };

    render(
      <LocationSidebar
        locations={mockLocations}
        selectedLocation={selectedLocation}
        onLocationSelect={mockOnLocationSelect}
      />,
    );

    // Should still be selected based on coordinates
    const selectedEntry = screen.getByText("Berlin Office").closest('[class*="border"]');
    expect(selectedEntry).toHaveClass("border-jii-dark-green", "bg-jii-dark-green/10");
  });

  it("renders with unique keys based on coordinates and index", () => {
    const locationsWithDuplicateCoords = [
      mockLocation1,
      { ...mockLocation1, name: "Duplicate Location" },
    ];

    render(
      <LocationSidebar
        locations={locationsWithDuplicateCoords}
        onLocationSelect={mockOnLocationSelect}
      />,
    );

    expect(screen.getByText("Berlin Office")).toBeInTheDocument();
    expect(screen.getByText("Duplicate Location")).toBeInTheDocument();
  });
});
