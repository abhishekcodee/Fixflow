/**
 * Client-side Geographic Utilities for Uber-style Location Tracking and Radius Calculations
 */

const EARTH_RADIUS_KM = 6371.0088;

/**
 * Validates coordinate pair.
 */
export const isValidCoordinate = (lat, lng) => {
  const numLat = Number(lat);
  const numLng = Number(lng);
  return (
    !isNaN(numLat) &&
    !isNaN(numLng) &&
    isFinite(numLat) &&
    isFinite(numLng) &&
    numLat >= -90 &&
    numLat <= 90 &&
    numLng >= -180 &&
    numLng <= 180
  );
};

/**
 * Haversine distance calculation in kilometers.
 */
export const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    return null;
  }

  const toRad = (degree) => (degree * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return Math.round(distance * 1000) / 1000;
};

/**
 * Formats distance into human-friendly string (meters if < 1km, else kilometers).
 */
export const formatDistance = (distanceKm) => {
  if (typeof distanceKm !== 'number' || isNaN(distanceKm) || distanceKm < 0) {
    return 'Distance unknown';
  }
  if (distanceKm < 0.1) {
    return `${Math.max(10, Math.round(distanceKm * 1000))} m away`;
  }
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
};

/**
 * Recommends optimal Leaflet zoom level for a given radius in kilometers.
 */
export const getOptimalZoomForRadius = (radiusKm) => {
  if (radiusKm <= 1) return 15;
  if (radiusKm <= 2) return 14;
  if (radiusKm <= 5) return 13;
  if (radiusKm <= 10) return 12;
  return 11;
};

/**
 * Calculates a bounding box [southWest, northEast] around a center point for a given radius.
 */
export const getRadiusBounds = (lat, lng, radiusKm) => {
  const latDelta = radiusKm / 111.0; // 1 degree lat is ~111 km
  const lngDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));
  
  return [
    [lat - latDelta, lng - lngDelta],
    [lat + latDelta, lng + lngDelta]
  ];
};

export default {
  isValidCoordinate,
  calculateDistanceKm,
  formatDistance,
  getOptimalZoomForRadius,
  getRadiusBounds,
};
