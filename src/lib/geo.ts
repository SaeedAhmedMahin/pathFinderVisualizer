import { Airport } from '@/types/flight';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const EARTH_RADIUS_KM = 6371;

/**
 * Computes Great-Circle Haversine distance between two coordinates in kilometers.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = lat1 * DEG_TO_RAD;
  const phi2 = lat2 * DEG_TO_RAD;
  const deltaPhi = (lat2 - lat1) * DEG_TO_RAD;
  const deltaLambda = (lon2 - lon1) * DEG_TO_RAD;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c);
}

/**
 * Spherical linear interpolation (Slerp) along the great-circle arc.
 * Returns an array of [lon, lat] coordinates connecting two points.
 */
export function interpolateGreatCircle(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  numPoints: number = 48
): [number, number][] {
  const p1 = lat1 * DEG_TO_RAD;
  const l1 = lon1 * DEG_TO_RAD;
  const p2 = lat2 * DEG_TO_RAD;
  const l2 = lon2 * DEG_TO_RAD;

  // Convert to 3D Cartesian coordinates
  const v1 = [
    Math.cos(p1) * Math.cos(l1),
    Math.cos(p1) * Math.sin(l1),
    Math.sin(p1),
  ];
  const v2 = [
    Math.cos(p2) * Math.cos(l2),
    Math.cos(p2) * Math.sin(l2),
    Math.sin(p2),
  ];

  // Dot product
  let dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  dot = Math.max(-1, Math.min(1, dot));

  const omega = Math.acos(dot);
  if (Math.abs(omega) < 1e-6) {
    return [
      [lon1, lat1],
      [lon2, lat2],
    ];
  }

  const sinOmega = Math.sin(omega);
  const points: [number, number][] = [];

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const a = Math.sin((1 - t) * omega) / sinOmega;
    const b = Math.sin(t * omega) / sinOmega;

    const x = a * v1[0] + b * v2[0];
    const y = a * v1[1] + b * v2[1];
    const z = a * v1[2] + b * v2[2];

    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * RAD_TO_DEG;
    const lon = Math.atan2(y, x) * RAD_TO_DEG;
    points.push([lon, lat]);
  }

  return points;
}

export interface MapTransform {
  scale: number;
  x: number;
  y: number;
}

/**
 * Projects (lon, lat) to canvas screen coordinates [px, py] with pan and zoom.
 */
export function projectGeo(
  lon: number,
  lat: number,
  canvasWidth: number,
  canvasHeight: number,
  transform: MapTransform
): [number, number] {
  // Equirectangular base coordinate [0..canvasWidth, 0..canvasHeight]
  const baseNormX = (lon + 180) / 360;
  // Natural Earth / Equirectangular latitude projection
  const baseNormY = (90 - lat) / 180;

  const baseX = baseNormX * canvasWidth;
  const baseY = baseNormY * canvasHeight;

  // Apply transform centered at canvas center
  const screenX = (baseX - canvasWidth / 2) * transform.scale + canvasWidth / 2 + transform.x;
  const screenY = (baseY - canvasHeight / 2) * transform.scale + canvasHeight / 2 + transform.y;

  return [screenX, screenY];
}

/**
 * Unprojects canvas screen coordinates [screenX, screenY] back to [lon, lat].
 */
export function unprojectGeo(
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number,
  transform: MapTransform
): [number, number] {
  const baseX = (screenX - transform.x - canvasWidth / 2) / transform.scale + canvasWidth / 2;
  const baseY = (screenY - transform.y - canvasHeight / 2) / transform.scale + canvasHeight / 2;

  const lon = (baseX / canvasWidth) * 360 - 180;
  const lat = 90 - (baseY / canvasHeight) * 180;

  return [lon, Math.max(-85, Math.min(85, lat))];
}

/**
 * Computes map transform to center and frame a list of airports.
 */
export function getBoundingBoxTransform(
  airports: Airport[],
  canvasWidth: number,
  canvasHeight: number,
  padding: number = 100
): MapTransform {
  if (airports.length === 0) {
    return { scale: 1, x: 0, y: 0 };
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;

  for (const a of airports) {
    if (a.lat < minLat) minLat = a.lat;
    if (a.lat > maxLat) maxLat = a.lat;
    if (a.lon < minLon) minLon = a.lon;
    if (a.lon > maxLon) maxLon = a.lon;
  }

  const centerLat = (minLat + maxLat) / 2;
  let centerLon = (minLon + maxLon) / 2;

  // Handle cross-antimeridian case if needed
  if (maxLon - minLon > 180) {
    centerLon = (centerLon + 180) % 360 - 180;
  }

  const latSpan = Math.max(20, maxLat - minLat);
  const lonSpan = Math.max(30, maxLon - minLon);

  const availableW = Math.max(200, canvasWidth - padding * 2);
  const availableH = Math.max(200, canvasHeight - padding * 2);

  const scaleX = (availableW / canvasWidth) * (360 / lonSpan);
  const scaleY = (availableH / canvasHeight) * (180 / latSpan);
  const targetScale = Math.min(4.5, Math.max(1.1, Math.min(scaleX, scaleY)));

  const baseNormX = (centerLon + 180) / 360;
  const baseNormY = (90 - centerLat) / 180;
  const baseX = baseNormX * canvasWidth;
  const baseY = baseNormY * canvasHeight;

  const targetX = -(baseX - canvasWidth / 2) * targetScale;
  const targetY = -(baseY - canvasHeight / 2) * targetScale;

  return {
    scale: targetScale,
    x: targetX,
    y: targetY,
  };
}

export function formatDistance(km: number): string {
  return `${km.toLocaleString()} km`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export function formatPrice(usd: number): string {
  return `$${usd.toLocaleString()}`;
}
