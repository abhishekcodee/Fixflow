/**
 * Geographic calculation utilities using Haversine formula and distance computations.
 */

const EARTH_RADIUS_KM = 6371.0088;

/**
 * Validates latitude and longitude values.
 * @param {number|string} lat
 * @param {number|string} lng
 * @returns {boolean}
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
 * Calculates great-circle distance between two coordinates in kilometers using Haversine formula.
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in kilometers rounded to 3 decimal places
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
 * Human-readable distance formatting.
 * @param {number} distanceKm 
 * @returns {string} Formatted distance string e.g. "450 m" or "2.4 km"
 */
export const formatDistance = (distanceKm) => {
  if (typeof distanceKm !== 'number' || isNaN(distanceKm) || distanceKm < 0) {
    return 'Distance unknown';
  }
  if (distanceKm < 0.1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
};

/**
 * Filters and annotates a list of complaints within a given radius.
 * @param {Array<object>} complaints
 * @param {number} centerLat
 * @param {number} centerLng
 * @param {number} radiusKm
 * @returns {Array<object>} Filtered and distance-annotated complaints sorted by distance
 */
export const filterComplaintsByRadius = (complaints = [], centerLat, centerLng, radiusKm = 5) => {
  if (!isValidCoordinate(centerLat, centerLng)) {
    return complaints;
  }

  const numRadius = Number(radiusKm) || 5;

  const annotated = [];

  for (const item of complaints) {
    const lat = item.location?.latitude ?? item.latitude;
    const lng = item.location?.longitude ?? item.longitude;

    if (!isValidCoordinate(lat, lng)) {
      continue;
    }

    const dist = calculateDistanceKm(centerLat, centerLng, lat, lng);
    if (dist !== null && dist <= numRadius) {
      const copy = typeof item.toSafeObject === 'function' ? item.toSafeObject() : { ...item };
      copy.distanceKm = dist;
      copy.distanceFormatted = formatDistance(dist);
      if (copy.location) {
        copy.location.distanceKm = dist;
        copy.location.distanceFormatted = formatDistance(dist);
      }
      annotated.push(copy);
    }
  }

  // Sort by ascending distance (Uber style: closest first)
  annotated.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));

  return annotated;
};

export default {
  isValidCoordinate,
  calculateDistanceKm,
  formatDistance,
  filterComplaintsByRadius,
};
