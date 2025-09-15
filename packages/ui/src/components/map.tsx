"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  ZoomControl,
  ScaleControl,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";

import { cn } from "../lib/utils";

/**
 * Map component for selecting and displaying locations
 * Uses OpenStreetMap with Leaflet
 */

export interface LocationPoint {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
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
   * Whether the map is in selection mode (allows adding new locations)
   */
  selectionMode?: boolean;
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
}

// Map component implementation
export const Map = ({
  locations = [],
  onLocationsChange,
  selectionMode = false,
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
}: MapProps) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(sidebarCollapsed);

  // Create a custom marker icon using Lucide MapPin-style SVG
  const createCustomMarker = useCallback((color: string = "#ef4444") => {
    const svgIcon = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
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
  }, []);

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

  // Handle adding new location
  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (!selectionMode || disabled) return;

      const newLocation: LocationPoint = {
        id: Date.now().toString(),
        name: `Location ${locations.length + 1}`,
        latitude: lat,
        longitude: lng,
      };

      const updatedLocations = [...locations, newLocation];
      onLocationsChange?.(updatedLocations);
    },
    [locations, onLocationsChange, selectionMode, disabled],
  );

  // Handle location name change
  const handleLocationNameChange = useCallback(
    (locationId: string, newName: string) => {
      const updatedLocations = locations.map((location) =>
        location.id === locationId ? { ...location, name: newName } : location,
      );
      onLocationsChange?.(updatedLocations);
    },
    [locations, onLocationsChange],
  );

  // Handle location removal
  const handleLocationRemove = useCallback(
    (locationId: string) => {
      const updatedLocations = locations.filter((location) => location.id !== locationId);
      onLocationsChange?.(updatedLocations);
    },
    [locations, onLocationsChange],
  );

  // Handle marker drag end
  const handleMarkerDragEnd = useCallback(
    (locationId: string, newPosition: any) => {
      const updatedLocations = locations.map((location) =>
        location.id === locationId
          ? { ...location, latitude: newPosition.lat, longitude: newPosition.lng }
          : location,
      );
      onLocationsChange?.(updatedLocations);
    },
    [locations, onLocationsChange],
  );

  return (
    <div className={cn("relative", className)}>
      {/* Sidebar Overlay */}
      {showSidebar && (
        <div
          className={cn(
            "absolute left-2 top-2 z-[900] flex flex-col transition-all duration-300 ease-in-out",
            isSidebarCollapsed ? "w-auto min-w-32" : "bottom-2 w-80",
          )}
        >
          <div
            className={cn(
              "flex flex-col rounded-lg border bg-white shadow-lg",
              isSidebarCollapsed ? "h-auto" : "h-full",
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
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {locations.length === 0 ? (
                    <p className="py-4 text-center text-sm text-gray-500">
                      {selectionMode
                        ? "Click on the map to add locations"
                        : "No locations to display"}
                    </p>
                  ) : (
                    locations.map((location, index) => (
                      <div
                        key={location.id || index}
                        className="space-y-2 rounded-lg border border-gray-200 p-3"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={location.name}
                            onChange={(e) =>
                              location.id && handleLocationNameChange(location.id, e.target.value)
                            }
                            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={disabled}
                            placeholder="Location name"
                          />
                          {selectionMode && !disabled && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                location.id && handleLocationRemove(location.id);
                              }}
                              className="rounded p-1 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                              title="Remove location"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="text-xs text-gray-600">
                          Lat: {location.latitude.toFixed(6)}, Lng: {location.longitude.toFixed(6)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Map Container */}
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border",
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
              {locations.map((location, index) => (
                <Marker
                  key={location.id || index}
                  position={[location.latitude, location.longitude]}
                  icon={createCustomMarker()}
                  draggable={selectionMode && !disabled}
                  eventHandlers={{
                    dragend: (event: any) => {
                      const marker = event.target;
                      const position = marker.getLatLng();
                      if (location.id) {
                        handleMarkerDragEnd(location.id, position);
                      }
                    },
                  }}
                >
                  <Popup>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={location.name}
                        onChange={(e) =>
                          location.id && handleLocationNameChange(location.id, e.target.value)
                        }
                        className="w-full rounded border px-2 py-1 text-sm"
                        disabled={disabled}
                      />
                      <div className="text-xs text-gray-600">
                        {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                      </div>
                      {selectionMode && !disabled && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            location.id && handleLocationRemove(location.id);
                          }}
                          className="w-full rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          ) : (
            locations.map((location, index) => (
              <Marker
                key={location.id || index}
                position={[location.latitude, location.longitude]}
                icon={createCustomMarker()}
                draggable={selectionMode && !disabled}
                eventHandlers={{
                  dragend: (event: any) => {
                    const marker = event.target;
                    const position = marker.getLatLng();
                    if (location.id) {
                      handleMarkerDragEnd(location.id, position);
                    }
                  },
                }}
              >
                <Popup>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={location.name}
                      onChange={(e) =>
                        location.id && handleLocationNameChange(location.id, e.target.value)
                      }
                      className="w-full rounded border px-2 py-1 text-sm"
                      disabled={disabled}
                    />
                    <div className="text-xs text-gray-600">
                      {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                    </div>
                    {selectionMode && !disabled && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          location.id && handleLocationRemove(location.id);
                        }}
                        className="w-full rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))
          )}
        </MapContainer>
      </div>
    </div>
  );
};

export default Map;
