"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  ZoomControl,
  ScaleControl,
  useMap,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";

import { cn } from "../../lib/utils";
import { LocationSearch } from "./location-search";
import { LocationSidebar } from "./location-sidebar";

/**
 * Map component with search functionality and improved location display
 */

export interface LocationPoint {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  region?: string;
  municipality?: string;
  postalCode?: string;
  address?: string;
  lastUpdated?: string;
}

export interface MapProps {
  /**
   * Array of locations to display on the map
   */
  locations?: LocationPoint[];
  /**
   * Callback when locations are updated
   */
  onLocationsChange?: (locations: LocationPoint[]) => void;
  /**
   * Callback when a location is added (for geocoding purposes)
   */
  onLocationAdd?: (latitude: number, longitude: number) => Promise<LocationPoint | void>;
  /**
   * Whether the map is in selection mode (allows adding new locations)
   */
  selectionMode?: boolean;
  /**
   * Whether to show the location search component
   */
  showLocationSearch?: boolean;
  /**
   * Callback function when user types in search input
   */
  onSearch?: (query: string) => void;
  /**
   * Search results to display in dropdown
   */
  searchResults?: Array<{
    label: string;
    latitude: number;
    longitude: number;
    country?: string;
    region?: string;
    municipality?: string;
    postalCode?: string;
  }>;
  /**
   * Whether search is currently loading
   */
  searchLoading?: boolean;
  /**
   * Default center of the map
   */
  center?: [number, number];
  /**
   * Default zoom level
   */
  zoom?: number;
  /**
   * Minimum zoom level
   */
  minZoom?: number;
  /**
   * Maximum zoom level
   */
  maxZoom?: number;
  /**
   * Height of the map container
   */
  height?: string;
  /**
   * If true, automatically fit the map bounds to include all provided locations when the map first loads
   */
  fitBoundsOnMapLoad?: boolean;
  /**
   * CSS class name for the container
   */
  className?: string;
  /**
   * Whether the map is disabled
   */
  disabled?: boolean;
  /**
   * Whether to show zoom controls
   */
  showZoomControl?: boolean;
  /**
   * Whether to show scale
   */
  showScale?: boolean;
  /**
   * Whether to use clustering for multiple markers
   */
  useClustering?: boolean;
  /**
   * Whether to show a sidebar with location list
   */
  showSidebar?: boolean;
  /**
   * Title for the sidebar
   */
  sidebarTitle?: string;
  /**
   * Whether the sidebar starts collapsed
   */
  sidebarCollapsed?: boolean;
  /**
   * Whether to show distances from a reference point
   */
  showDistances?: boolean;
  /**
   * Reference point for distance calculations
   */
  referencePoint?: [number, number];
}

// Component to handle map view changes
const MapViewController = ({
  center,
  zoom,
  shouldPan,
}: {
  center: [number, number];
  zoom?: number;
  shouldPan: boolean;
}) => {
  const map = useMap();

  useEffect(() => {
    if (shouldPan) {
      map.setView(center, zoom || map.getZoom(), { animate: true });
    }
  }, [map, center, zoom, shouldPan]);

  return null;
};

// Controller to fit map bounds to provided locations
const FitBoundsController = ({
  locations,
  padding = [50, 50],
  maxZoomOverride,
}: {
  locations: LocationPoint[];
  padding?: [number, number];
  maxZoomOverride?: number;
}) => {
  const map = useMap();
  const hasFittedRef = React.useRef(false);

  useEffect(() => {
    // Only fit once on initial load (first time we have locations)
    if (!map || !locations || locations.length === 0) return;
    if (hasFittedRef.current) return;

    if (locations.length === 1) {
      // For single location, set a reasonable zoom but don't over-zoom
      const loc = locations[0];
      if (loc) {
        const targetZoom = Math.min(maxZoomOverride ?? map.getMaxZoom(), 12);
        map.setView([loc.latitude, loc.longitude], targetZoom, { animate: true });
      }
      return;
    }

    try {
      const latLngs = locations.map((l) => [l.latitude, l.longitude] as [number, number]);
      const bounds = L.latLngBounds(latLngs);
      // Use fitBounds with padding and a maxZoom to avoid over-zooming for distant points
      map.fitBounds(bounds, { padding, maxZoom: maxZoomOverride ?? 10, animate: true });
      hasFittedRef.current = true;
    } catch (err) {
      console.error("Error fitting map bounds:", err);
      // Fallback: center on average
      const centerLat = locations.reduce((s, l) => s + l.latitude, 0) / locations.length;
      const centerLng = locations.reduce((s, l) => s + l.longitude, 0) / locations.length;
      map.setView([centerLat, centerLng], Math.min(maxZoomOverride ?? map.getZoom(), 4), {
        animate: true,
      });
      hasFittedRef.current = true;
    }
  }, [map, locations, padding, maxZoomOverride]);

  return null;
};

// Calculate distance between two points in kilometers
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Map component implementation
export const Map = ({
  locations = [],
  onLocationsChange,
  onLocationAdd,
  selectionMode = false,
  showLocationSearch = false,
  onSearch,
  searchResults = [],
  searchLoading = false,
  center = [40.7128, -74.006],
  zoom = 10,
  minZoom = 1,
  maxZoom = 18,
  height = "400px",
  className,
  disabled = false,
  showZoomControl = true,
  showScale = true,
  useClustering = true,
  showSidebar = false,
  sidebarTitle = "Locations",
  sidebarCollapsed = false,
  showDistances = false,
  referencePoint,
  fitBoundsOnMapLoad = true,
}: MapProps) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(sidebarCollapsed);
  const [selectedLocation, setSelectedLocation] = useState<LocationPoint | undefined>();
  const [mapCenter, setMapCenter] = useState<[number, number]>(center);
  const [mapZoom, setMapZoom] = useState(zoom);
  const [shouldPanToLocation, setShouldPanToLocation] = useState(false);

  // Create a custom marker icon
  const createCustomMarker = useCallback(
    (color: string = "#ef4444", isSelected: boolean = false) => {
      const svgIcon = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="${isSelected ? 3 : 2}" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    `;

      return L.divIcon({
        html: svgIcon,
        className: "custom-marker",
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        popupAnchor: [0, -24],
      });
    },
    [],
  );

  // Map click handler for adding new locations
  const MapClickHandler = ({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) => {
    useMapEvents({
      click: (event: any) => {
        if (selectionMode && !disabled) {
          onMapClick(event.latlng.lat, event.latlng.lng);
        }
      },
    });
    return null;
  };

  // Handle adding new location from map click
  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      if (!selectionMode || disabled) return;

      if (onLocationAdd) {
        try {
          const enhancedLocation = await onLocationAdd(lat, lng);
          if (enhancedLocation) {
            const updatedLocations = [...locations, enhancedLocation];
            onLocationsChange?.(updatedLocations);
          }
        } catch (error) {
          // Handle error gracefully - could add error callback or logging
          console.error("Failed to add location:", error);
        }
      } else {
        // Fallback to basic location creation if no callback provided
        const newLocation: LocationPoint = {
          id: Date.now().toString(),
          name: `Location ${locations.length + 1}`,
          latitude: lat,
          longitude: lng,
          lastUpdated: new Date().toISOString(),
        };

        const updatedLocations = [...locations, newLocation];
        onLocationsChange?.(updatedLocations);
      }
    },
    [locations, onLocationsChange, onLocationAdd, selectionMode, disabled],
  );

  // Handle adding location from search
  const handleLocationSearchSelect = useCallback(
    (searchResult: any) => {
      const newLocation: LocationPoint = {
        id: Date.now().toString(),
        name: searchResult.label,
        latitude: searchResult.latitude,
        longitude: searchResult.longitude,
        country: searchResult.country,
        region: searchResult.region,
        municipality: searchResult.municipality,
        postalCode: searchResult.postalCode,
        lastUpdated: new Date().toISOString(),
      };

      if (selectionMode) {
        const updatedLocations = [...locations, newLocation];
        onLocationsChange?.(updatedLocations);
      }

      // Pan to the selected location
      setMapCenter([searchResult.latitude, searchResult.longitude]);
      setMapZoom(14);
      setShouldPanToLocation(true);
      setTimeout(() => setShouldPanToLocation(false), 100);
    },
    [locations, onLocationsChange, selectionMode],
  );

  const enhancedLocations = locations.map((location) => ({
    ...location,
    distance:
      showDistances && referencePoint
        ? calculateDistance(
            referencePoint[0],
            referencePoint[1],
            location.latitude,
            location.longitude,
          )
        : undefined,
  }));

  // Handle location selection from sidebar
  const handleLocationSelectFromSidebar = useCallback((location: LocationPoint) => {
    setSelectedLocation(location);
    setMapCenter([location.latitude, location.longitude]);
    setMapZoom(14);
    setShouldPanToLocation(true);
    setTimeout(() => setShouldPanToLocation(false), 100);
  }, []);

  // Handle navigation to location from sidebar
  const handleLocationNavigateFromSidebar = useCallback((location: LocationPoint) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`;
    window.open(url, "_blank");
  }, []);

  // Handle location removal from sidebar
  const handleLocationRemoveFromSidebar = useCallback(
    (location: LocationPoint) => {
      if (!selectionMode || disabled) return;

      const updatedLocations = locations.filter(
        (loc) =>
          !(
            loc.latitude === location.latitude &&
            loc.longitude === location.longitude &&
            loc.id === location.id
          ),
      );
      onLocationsChange?.(updatedLocations);

      // Clear selection if the removed location was selected
      if (
        selectedLocation &&
        selectedLocation.latitude === location.latitude &&
        selectedLocation.longitude === location.longitude &&
        selectedLocation.id === location.id
      ) {
        setSelectedLocation(undefined);
      }
    },
    [locations, onLocationsChange, selectionMode, disabled, selectedLocation],
  );

  return (
    <div className={cn("relative z-0", className)}>
      {/* Location Search Overlay */}
      {showLocationSearch && (
        <div className="absolute left-1/2 top-4 z-[1000] w-full max-w-md -translate-x-1/2 transform px-4">
          <LocationSearch
            onLocationSelect={handleLocationSearchSelect}
            onSearch={onSearch}
            searchResults={searchResults}
            searchLoading={searchLoading}
            placeholder="Search for locations..."
            className="w-full"
            disabled={disabled}
          />
        </div>
      )}

      {/* Sidebar Overlay */}
      {showSidebar && (
        <div
          className={cn(
            "absolute bottom-2 left-2 z-[900] flex flex-col transition-all duration-300 ease-in-out",
            isSidebarCollapsed ? "w-auto min-w-32" : "max-h-96 w-80",
          )}
        >
          <div
            className={cn(
              "flex flex-col rounded-lg border bg-white shadow-lg",
              isSidebarCollapsed ? "h-auto" : "max-h-96",
            )}
          >
            {/* Sidebar Header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b p-3">
              <h3 className={cn("text-sm font-semibold", isSidebarCollapsed && "truncate")}>
                {sidebarTitle}
              </h3>
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="ml-2 flex-shrink-0 rounded p-1 transition-colors hover:bg-gray-100"
                title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isSidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Sidebar Content */}
            {!isSidebarCollapsed && (
              <div className="flex min-h-0 flex-1 flex-col p-3">
                <div className="flex-1 overflow-y-auto">
                  <LocationSidebar
                    locations={enhancedLocations}
                    selectedLocation={selectedLocation}
                    onLocationSelect={handleLocationSelectFromSidebar}
                    onLocationNavigate={handleLocationNavigateFromSidebar}
                    onLocationRemove={handleLocationRemoveFromSidebar}
                    showDistances={showDistances}
                    selectionMode={!disabled && selectionMode}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Map Container */}
      <div
        className={cn(
          "relative z-0 overflow-hidden rounded-lg border",
          disabled && "cursor-not-allowed opacity-50",
        )}
        style={{ height, width: "100%" }}
      >
        <MapContainer
          center={center}
          zoom={zoom}
          minZoom={minZoom}
          maxZoom={maxZoom}
          zoomControl={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          <MapViewController center={mapCenter} zoom={mapZoom} shouldPan={shouldPanToLocation} />

          {fitBoundsOnMapLoad && locations.length > 0 && (
            <FitBoundsController locations={locations} maxZoomOverride={maxZoom} />
          )}

          {showZoomControl && <ZoomControl position="topright" />}
          {showScale && <ScaleControl position="bottomright" />}

          {selectionMode && !disabled && <MapClickHandler onMapClick={handleMapClick} />}

          {useClustering && locations.length > 0 ? (
            <MarkerClusterGroup
              chunkedLoading
              iconCreateFunction={(cluster: any) => {
                const count = cluster.getChildCount();
                return L.divIcon({
                  html: `<div style="background: #ef4444; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">${count}</div>`,
                  className: "custom-cluster-icon",
                  iconSize: [40, 40],
                });
              }}
            >
              {locations.map((location, index) => {
                const isSelected = selectedLocation?.id === location.id;
                return (
                  <Marker
                    key={location.id || index}
                    position={[location.latitude, location.longitude]}
                    icon={createCustomMarker(isSelected ? "#2563eb" : "#ef4444", isSelected)}
                    draggable={selectionMode && !disabled}
                    eventHandlers={{
                      click: () => setSelectedLocation(location),
                    }}
                  >
                    <Popup>
                      <div className="min-w-0 space-y-2">
                        <div className="font-semibold">{location.name}</div>
                        {location.address && (
                          <div className="text-sm text-gray-600">{location.address}</div>
                        )}
                        <div className="text-xs text-gray-500">
                          {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                        </div>
                        {[location.municipality, location.region, location.country].filter(Boolean)
                          .length > 0 && (
                          <div className="text-xs text-gray-500">
                            {[location.municipality, location.region, location.country]
                              .filter(Boolean)
                              .join(", ")}
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MarkerClusterGroup>
          ) : (
            locations.map((location, index) => {
              const isSelected = selectedLocation?.id === location.id;
              return (
                <Marker
                  key={location.id || index}
                  position={[location.latitude, location.longitude]}
                  icon={createCustomMarker(isSelected ? "#2563eb" : "#ef4444", isSelected)}
                  draggable={selectionMode && !disabled}
                  eventHandlers={{
                    click: () => setSelectedLocation(location),
                  }}
                >
                  <Popup>
                    <div className="min-w-0 space-y-2">
                      <div className="font-semibold">{location.name}</div>
                      {location.address && (
                        <div className="text-sm text-gray-600">{location.address}</div>
                      )}
                      <div className="text-xs text-gray-500">
                        {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                      </div>
                      {[location.municipality, location.region, location.country].filter(Boolean)
                        .length > 0 && (
                        <div className="text-xs text-gray-500">
                          {[location.municipality, location.region, location.country]
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })
          )}
        </MapContainer>
      </div>
    </div>
  );
};

export default Map;
