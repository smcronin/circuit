import React, { useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { colors, fonts, borderRadius } from '@/theme';
import type { RidePoint } from '@/types/ride';
import { RouteTrace } from './RouteTrace';
import {
  TILE_SIZE,
  OSM_ATTRIBUTION,
  OSM_COPYRIGHT_URL,
  fitViewport,
  tilesForViewport,
  projectToViewport,
  sampleTrack,
} from '@/utils/tiles';

interface RouteMapProps {
  points: RidePoint[];
  width: number;
  height: number;
  /** Points drawn for the polyline. Plenty for a map this size. */
  trackBudget?: number;
}

/**
 * The ride's route drawn over OpenStreetMap tiles.
 *
 * Deliberately not an interactive map: no library, no API key, no pan/zoom —
 * just the handful of tile images that cover the route, with the track composited
 * on top in the same Mercator frame. That keeps the bundle lean and keeps tile
 * requests to what's actually on screen, which is what OSM's usage policy asks
 * for.
 *
 * If tiles fail (offline, blocked, rate-limited) it degrades to the plain SVG
 * trace rather than showing an empty box — the route shape is the point, the
 * streets underneath are a bonus.
 */
export function RouteMap({ points, width, height, trackBudget = 400 }: RouteMapProps) {
  const [failedTiles, setFailedTiles] = useState<Record<string, boolean>>({});

  const model = useMemo(() => {
    if (points.length < 2 || width <= 0 || height <= 0) return null;
    const viewport = fitViewport(points, width, height);
    if (!viewport) return null;

    const track = sampleTrack(points, trackBudget);
    const projected = track.map((p) => projectToViewport(p.lat, p.lon, viewport));

    return {
      tiles: tilesForViewport(viewport),
      polyline: projected.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
      start: projected[0],
      end: projected[projected.length - 1],
    };
  }, [points, width, height, trackBudget]);

  if (!model) {
    return <RouteTrace points={points} width={width} height={height} showEndpoints />;
  }

  // Every tile erroring means the tile layer is unavailable, not that one image
  // hiccuped — fall back rather than framing a blank grey rectangle.
  const allTilesFailed =
    model.tiles.length > 0 && model.tiles.every((tile) => failedTiles[tile.key]);

  if (allTilesFailed) {
    return <RouteTrace points={points} width={width} height={height} showEndpoints />;
  }

  return (
    <View style={[styles.frame, { width, height }]}>
      {model.tiles.map((tile) =>
        failedTiles[tile.key] ? null : (
          <Image
            key={tile.key}
            source={{ uri: tile.url }}
            style={[styles.tile, { left: tile.left, top: tile.top }]}
            onError={() => setFailedTiles((prev) => ({ ...prev, [tile.key]: true }))}
          />
        )
      )}

      {/* OSM's default style is bright; this scrim settles it into the app's
          near-black canvas and makes the indigo route read clearly on top. */}
      <View style={styles.scrim} pointerEvents="none" />

      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {/* A dark casing under the route keeps it legible over pale roads. */}
        <Polyline
          points={model.polyline}
          fill="none"
          stroke="rgba(6, 10, 20, 0.75)"
          strokeWidth={6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Polyline
          points={model.polyline}
          fill="none"
          stroke={colors.primaryLight}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Circle cx={model.start.x} cy={model.start.y} r={5} fill={colors.success} stroke="#060A14" strokeWidth={1.5} />
        <Circle cx={model.end.x} cy={model.end.y} r={5} fill={colors.accent} stroke="#060A14" strokeWidth={1.5} />
      </Svg>

      <TouchableOpacity
        style={styles.attribution}
        onPress={() => Linking.openURL(OSM_COPYRIGHT_URL)}
        activeOpacity={0.7}
      >
        <Text style={styles.attributionText}>{OSM_ATTRIBUTION}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
  },
  tile: {
    position: 'absolute',
    width: TILE_SIZE,
    height: TILE_SIZE,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 10, 20, 0.38)',
  },
  attribution: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderTopLeftRadius: borderRadius.xs,
    backgroundColor: 'rgba(6, 10, 20, 0.72)',
  },
  attributionText: {
    fontFamily: fonts.displayMedium,
    fontSize: 9,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
});
