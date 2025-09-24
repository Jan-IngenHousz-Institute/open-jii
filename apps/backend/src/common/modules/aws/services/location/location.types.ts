export interface PlaceSearchResult {
  label: string;
  latitude: number;
  longitude: number;
  country?: string;
  region?: string;
  municipality?: string;
  postalCode?: string;
}

export interface GeocodeResult {
  label: string;
  latitude: number;
  longitude: number;
  country?: string;
  region?: string;
  municipality?: string;
  postalCode?: string;
}

export interface SearchPlacesRequest {
  query: string;
  maxResults?: number;
}

export interface GeocodeLocationRequest {
  latitude: number;
  longitude: number;
}
