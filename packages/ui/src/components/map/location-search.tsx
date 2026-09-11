"use client";

import { Search, MapPin, Loader2 } from "lucide-react";
import { useState, useCallback, useEffect } from "react";

interface LocationSearchResult {
  label: string;
  latitude: number;
  longitude: number;
  country?: string;
  region?: string;
  municipality?: string;
  postalCode?: string;
}

interface LocationSearchProps {
  onLocationSelect: (location: LocationSearchResult) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onSearch?: (query: string) => void;
  searchResults?: LocationSearchResult[];
  searchLoading?: boolean;
}

export const LocationSearch = ({
  onLocationSelect,
  placeholder = "Search for locations...",
  className = "",
  disabled = false,
  onSearch,
  searchResults = [],
  searchLoading = false,
}: LocationSearchProps) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Call onSearch when query changes
  useEffect(() => {
    if (onSearch) {
      onSearch(query);
    }
  }, [query, onSearch]);

  // Use the provided search results and loading state
  const results = searchResults;
  const isLoading = searchLoading;

  // Handle location selection
  const handleLocationSelect = useCallback(
    (location: LocationSearchResult) => {
      onLocationSelect(location);
      setQuery(location.label);
      setIsOpen(false);
      setSelectedIndex(-1);
    },
    [onLocationSelect],
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || results.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < results.length) {
            const selectedLocation = results[selectedIndex];
            if (selectedLocation) {
              handleLocationSelect(selectedLocation);
            }
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setSelectedIndex(-1);
          break;
      }
    },
    [isOpen, results, selectedIndex, handleLocationSelect],
  );

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            // Delay closing to allow clicking on results
            setTimeout(() => setIsOpen(false), 200);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="border-input bg-background focus:border-ring focus:ring-ring/50 focus:outline-hidden disabled:bg-muted disabled:text-muted-foreground w-full rounded-lg border px-10 py-2 text-sm focus:ring-2"
        />
        {isLoading && (
          <Loader2 className="text-muted-foreground absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" />
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && query.length >= 3 && (
        <div className="bg-popover absolute top-full z-50 mt-1 w-full rounded-lg border shadow-lg">
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
              <span className="text-muted-foreground ml-2 text-sm">Searching...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-64 overflow-y-auto">
              {results.map((location: LocationSearchResult, index: number) => (
                <button
                  key={`${location.latitude}-${location.longitude}-${index}`}
                  onClick={() => handleLocationSelect(location)}
                  className={`focus:outline-hidden hover:bg-accent focus:bg-accent w-full px-4 py-3 text-left text-sm ${
                    index === selectedIndex ? "bg-accent" : ""
                  }`}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="flex items-start gap-3">
                    <MapPin className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-foreground truncate font-medium">{location.label}</div>
                      <div className="text-muted-foreground text-xs">
                        {[location.municipality, location.region, location.country]
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : query.length >= 3 ? (
            <div className="text-muted-foreground p-4 text-center text-sm">
              No locations found for "{query}"
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
