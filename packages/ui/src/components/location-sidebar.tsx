"use client";

import { MapPin, Calendar, ExternalLink, Navigation2 } from "lucide-react";

interface EnhancedLocationInfo {
  id?: string;
  name: string; // Changed from label to name to match LocationPoint
  latitude: number;
  longitude: number;
  country?: string;
  region?: string;
  municipality?: string;
  postalCode?: string;
  address?: string;
  lastUpdated?: string;
  distance?: number; // Distance from user or reference point in km
}

interface LocationSidebarEntryProps {
  location: EnhancedLocationInfo;
  isSelected?: boolean;
  onClick?: () => void;
  onNavigate?: () => void;
  showDistance?: boolean;
}

const formatDistance = (distance: number): string => {
  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`;
  }
  return `${distance.toFixed(1)}km`;
};

const formatCoordinates = (lat: number, lng: number): string => {
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
};

export const LocationSidebarEntry = ({
  location,
  isSelected = false,
  onClick,
  onNavigate,
  showDistance = false,
}: LocationSidebarEntryProps) => {
  const {
    name,
    latitude,
    longitude,
    country,
    region,
    municipality,
    postalCode,
    address,
    lastUpdated,
    distance,
  } = location;

  const fullAddress = [municipality, region, country].filter(Boolean).join(", ");
  const coordinates = formatCoordinates(latitude, longitude);

  return (
    <div
      className={`cursor-pointer rounded-lg border p-4 transition-all duration-200 hover:shadow-md ${
        isSelected
          ? "border-blue-500 bg-blue-50 shadow-md"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Location Name */}
          <div className="flex items-start gap-2">
            <MapPin
              className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                isSelected ? "text-blue-600" : "text-gray-500"
              }`}
            />
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold text-gray-900" title={name}>
                {name}
              </h3>
            </div>
          </div>

          {/* Address Information */}
          {(address || fullAddress) && (
            <div className="mt-2 text-sm text-gray-600">
              <div className="truncate" title={address || fullAddress}>
                {address || fullAddress}
              </div>
              {postalCode && <div className="mt-1 text-xs text-gray-500">{postalCode}</div>}
            </div>
          )}

          {/* Coordinates */}
          <div className="mt-2 font-mono text-xs text-gray-500">{coordinates}</div>

          {/* Distance and Last Updated */}
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-3">
              {showDistance && distance !== undefined && (
                <span className="inline-flex items-center gap-1">
                  <Navigation2 className="h-3 w-3" />
                  {formatDistance(distance)}
                </span>
              )}
              {lastUpdated && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(lastUpdated).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          {onNavigate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigate();
              }}
              className="rounded p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
              title="Navigate to location"
            >
              <Navigation2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
              window.open(url, "_blank");
            }}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-green-50 hover:text-green-600"
            title="Open in Google Maps"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

interface LocationSidebarProps {
  locations: EnhancedLocationInfo[];
  selectedLocation?: EnhancedLocationInfo;
  onLocationSelect?: (location: EnhancedLocationInfo) => void;
  onLocationNavigate?: (location: EnhancedLocationInfo) => void;
  showDistances?: boolean;
  className?: string;
}

export const LocationSidebar = ({
  locations,
  selectedLocation,
  onLocationSelect,
  onLocationNavigate,
  showDistances = false,
  className = "",
}: LocationSidebarProps) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {locations.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <MapPin className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <p className="text-sm">No locations to display</p>
        </div>
      ) : (
        locations.map((location, index) => (
          <LocationSidebarEntry
            key={`${location.latitude}-${location.longitude}-${index}`}
            location={location}
            isSelected={
              selectedLocation
                ? selectedLocation.latitude === location.latitude &&
                  selectedLocation.longitude === location.longitude
                : false
            }
            onClick={() => onLocationSelect?.(location)}
            onNavigate={() => onLocationNavigate?.(location)}
            showDistance={showDistances}
          />
        ))
      )}
    </div>
  );
};
