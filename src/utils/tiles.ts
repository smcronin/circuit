// ─── Slippy-map tile math (Web Mercator) ────────────────────────────────────
// Enough of the standard tile scheme to draw a static route map without a map
// library. We are not building a pannable map — just "show me where I rode" —
// so this fits a viewport to the ride's bounding box once and renders the few
// tiles that cover it.
//
// Tiles come from OpenStreetMap's public servers. Their usage policy allows
// third-party apps for normal interactive viewing, but forbids pre-seeding or
// building offline archives, so we only ever request tiles for a route the user
// is actually looking at. Attribution is required and lives in RouteMap.
// https://operations.osmfoundation.org/policies/tiles/

import type { RidePoint } from '@/types/ride';

export const TILE_SIZE = 256;
export const MIN_ZOOM = 2;
/** Street-level detail. OSM serves to 19, but a ride rarely needs past 17. */
export const MAX_ZOOM = 17;

export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';
export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';

export function osmTileUrl(z: number, x: number, y: number): string {
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

/** Longitude → absolute world pixel X at a zoom level. */
export function lonToWorldX(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * TILE_SIZE * Math.pow(2, zoom);
}

/** Latitude → absolute world pixel Y at a zoom level (Mercator). */
export function latToWorldY(lat: number, zoom: number): number {
  // Clamp to the Mercator limit; beyond ±85.05° the projection diverges.
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = (clamped * Math.PI) / 180;
  const normalized = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
  return normalized * TILE_SIZE * Math.pow(2, zoom);
}

export interface MapViewport {
  zoom: number;
  /** Absolute world pixel coordinates of the viewport's top-left corner. */
  topLeftX: number;
  topLeftY: number;
  width: number;
  height: number;
}

export interface TilePlacement {
  key: string;
  url: string;
  /** Offset within the viewport, in pixels. */
  left: number;
  top: number;
}

interface Bounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

function boundsOf(points: RidePoint[]): Bounds | null {
  if (!points.length) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  return { minLat, maxLat, minLon, maxLon };
}

/**
 * Pick the highest zoom at which the whole route still fits, then centre it.
 *
 * `padding` keeps the trace off the edges — a route that touches the frame
 * looks clipped even when it isn't.
 */
export function fitViewport(
  points: RidePoint[],
  width: number,
  height: number,
  padding = 12
): MapViewport | null {
  const bounds = boundsOf(points);
  if (!bounds || width <= 0 || height <= 0) return null;

  const usableW = Math.max(1, width - padding * 2);
  const usableH = Math.max(1, height - padding * 2);

  let zoom = MIN_ZOOM;
  for (let z = MAX_ZOOM; z >= MIN_ZOOM; z--) {
    const spanX = lonToWorldX(bounds.maxLon, z) - lonToWorldX(bounds.minLon, z);
    // World Y grows southward, so maxLat produces the smaller value.
    const spanY = latToWorldY(bounds.minLat, z) - latToWorldY(bounds.maxLat, z);
    if (spanX <= usableW && spanY <= usableH) {
      zoom = z;
      break;
    }
  }

  const centerX = (lonToWorldX(bounds.minLon, zoom) + lonToWorldX(bounds.maxLon, zoom)) / 2;
  const centerY = (latToWorldY(bounds.minLat, zoom) + latToWorldY(bounds.maxLat, zoom)) / 2;

  return {
    zoom,
    topLeftX: centerX - width / 2,
    topLeftY: centerY - height / 2,
    width,
    height,
  };
}

/** The tiles needed to cover a viewport, with their offsets inside it. */
export function tilesForViewport(viewport: MapViewport): TilePlacement[] {
  const { zoom, topLeftX, topLeftY, width, height } = viewport;
  const n = Math.pow(2, zoom);

  const firstCol = Math.floor(topLeftX / TILE_SIZE);
  const lastCol = Math.floor((topLeftX + width) / TILE_SIZE);
  const firstRow = Math.floor(topLeftY / TILE_SIZE);
  const lastRow = Math.floor((topLeftY + height) / TILE_SIZE);

  const tiles: TilePlacement[] = [];
  for (let col = firstCol; col <= lastCol; col++) {
    for (let row = firstRow; row <= lastRow; row++) {
      // Rows above the north pole or below the south don't exist; skip them
      // rather than requesting a guaranteed 404.
      if (row < 0 || row >= n) continue;
      // Columns wrap around the globe.
      const wrappedCol = ((col % n) + n) % n;
      tiles.push({
        key: `${zoom}/${wrappedCol}/${row}`,
        url: osmTileUrl(zoom, wrappedCol, row),
        left: col * TILE_SIZE - topLeftX,
        top: row * TILE_SIZE - topLeftY,
      });
    }
  }
  return tiles;
}

/** Project a GPS coordinate into viewport pixel space. */
export function projectToViewport(
  lat: number,
  lon: number,
  viewport: MapViewport
): { x: number; y: number } {
  return {
    x: lonToWorldX(lon, viewport.zoom) - viewport.topLeftX,
    y: latToWorldY(lat, viewport.zoom) - viewport.topLeftY,
  };
}

/**
 * Thin a track to a point budget. A 2-hour ride is ~7,000 fixes and a 340px
 * map cannot show that detail; drawing them all just costs frame time.
 * Always keeps the first and last point so the endpoint markers stay honest.
 */
export function sampleTrack(points: RidePoint[], budget: number): RidePoint[] {
  if (points.length <= budget) return points;
  const stride = Math.ceil(points.length / budget);
  const out = points.filter((_, i) => i % stride === 0);
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}
