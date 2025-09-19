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
  debounceMs?: number;
  disabled?: boolean;
  useLocationSearchHook?: (
    query: string,
    maxResults?: number,
    enabled?: boolean,
  ) => {
    data?: { body: LocationSearchResult[] };
    isLoading: boolean;
    error?: Error;
  };
}

// Default mock implementation - this should be replaced when the hook is provided
const defaultLocationSearchHook = (query: string, maxResults?: number, enabled: boolean = true) => {
  const [data, setData] = useState<{ body: LocationSearchResult[] } | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    if (!enabled || query.length < 3) {
      setData(undefined);
      setIsLoading(false);
      setError(undefined);
      return;
    }

    setIsLoading(true);
    setError(undefined);

    // Simulate API call
    const timer = setTimeout(() => {
      setData({
        body: [
          {
            label: `${query} - Sample Location`,
            latitude: 40.7128,
            longitude: -74.006,
            country: "United States",
            region: "New York",
            municipality: "New York City",
            postalCode: "10001",
          },
        ],
      });
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [query, enabled, maxResults]);

  return { data, isLoading, error };
};

export const LocationSearch = ({
  onLocationSelect,
  placeholder = "Search for locations...",
  className = "",
  debounceMs = 300,
  disabled = false,
  useLocationSearchHook = defaultLocationSearchHook,
}: LocationSearchProps) => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  const { data, isLoading } = useLocationSearchHook(
    debouncedQuery,
    undefined,
    debouncedQuery.length >= 3,
  );
  const results = data?.body ?? [];

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
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
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
          className="w-full rounded-lg border border-gray-300 bg-white px-10 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-50 disabled:text-gray-500"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && query.length >= 3 && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Searching...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-64 overflow-y-auto">
              {results.map((location: LocationSearchResult, index: number) => (
                <button
                  key={`${location.latitude}-${location.longitude}-${index}`}
                  onClick={() => handleLocationSelect(location)}
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none ${
                    index === selectedIndex ? "bg-blue-50" : ""
                  }`}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-gray-900">{location.label}</div>
                      <div className="text-xs text-gray-500">
                        {[location.municipality, location.region, location.country]
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                      <div className="text-xs text-gray-400">
                        {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : query.length >= 3 ? (
            <div className="p-4 text-center text-sm text-gray-500">
              No locations found for "{query}"
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
