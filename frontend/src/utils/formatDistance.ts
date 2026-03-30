export function formatDistance(distanceKm?: number | null): string {
  if (distanceKm === null || distanceKm === undefined) return 'Distance unknown';

  // Distances from backend are in kilometers.
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters}m away`;
  }

  return `${distanceKm.toFixed(1)} km away`;
}

export default formatDistance;
