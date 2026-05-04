/**
 * Haversine formula to calculate distance between two coordinates in km
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Score a worker based on distance (0–1, closer = higher score)
 */
export function distanceScore(distanceKm, maxDistanceKm = 20) {
  if (distanceKm >= maxDistanceKm) return 0;
  return 1 - (distanceKm / maxDistanceKm);
}
