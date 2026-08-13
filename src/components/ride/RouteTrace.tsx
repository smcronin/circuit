import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { colors } from '@/theme';
import type { RidePoint } from '@/types/ride';

interface RouteTraceProps {
  points: RidePoint[];
  width: number;
  height: number;
  /** Draw start/finish dots. Off for small history thumbnails. */
  showEndpoints?: boolean;
  strokeWidth?: number;
  color?: string;
}

/**
 * The ride's shape, drawn from raw GPS with no map tiles behind it.
 *
 * Deliberately tile-free: tiles mean an API key, a network call per ride, and
 * handing a third party the coordinates of Seth's front door. The trace alone
 * is enough to recognise which loop you rode.
 *
 * Longitude is scaled by cos(latitude) so the route isn't horizontally stretched
 * — at 42°N a degree of longitude is only ~74% as wide as a degree of latitude.
 */
export function RouteTrace({
  points,
  width,
  height,
  showEndpoints = false,
  strokeWidth = 2.5,
  color = colors.primary,
}: RouteTraceProps) {
  const geometry = useMemo(() => {
    if (points.length < 2) return null;

    // A 2-hour ride is ~7,000 fixes. Rendering all of them into a 78px history
    // thumbnail costs real frame time and buys no visible detail, so thin the
    // track to a budget that still traces the same shape. (Also keeps the
    // min/max below out of `Math.min(...arr)` stack-overflow territory.)
    const budget = Math.max(64, Math.round(Math.max(width, height) * 4));
    const stride = Math.ceil(points.length / budget);
    const sampled =
      stride > 1
        ? points.filter((_, i) => i % stride === 0 || i === points.length - 1)
        : points;

    const meanLat = sampled.reduce((sum, p) => sum + p.lat, 0) / sampled.length;
    const lonScale = Math.cos((meanLat * Math.PI) / 180) || 1;

    const xs = sampled.map((p) => p.lon * lonScale);
    const ys = sampled.map((p) => p.lat);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < xs.length; i++) {
      if (xs[i] < minX) minX = xs[i];
      if (xs[i] > maxX) maxX = xs[i];
      if (ys[i] < minY) minY = ys[i];
      if (ys[i] > maxY) maxY = ys[i];
    }

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    // An out-and-back on one road has near-zero span on an axis; guard the divide.
    const span = Math.max(spanX, spanY, 1e-9);

    const padding = strokeWidth + 2;
    const usableW = Math.max(1, width - padding * 2);
    const usableH = Math.max(1, height - padding * 2);
    const scale = Math.min(usableW / span, usableH / span);

    // Centre whichever axis is shorter so the trace sits in the middle.
    const offsetX = padding + (usableW - spanX * scale) / 2;
    const offsetY = padding + (usableH - spanY * scale) / 2;

    const projected = sampled.map((p, i) => ({
      // SVG y grows downward; latitude grows north, so flip it.
      x: offsetX + (xs[i] - minX) * scale,
      y: offsetY + (maxY - ys[i]) * scale,
    }));

    return {
      polyline: projected.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
      start: projected[0],
      end: projected[projected.length - 1],
    };
  }, [points, width, height, strokeWidth]);

  if (!geometry) {
    return <View style={[styles.placeholder, { width, height }]} />;
  }

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={geometry.polyline}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {showEndpoints && (
        <>
          <Circle cx={geometry.start.x} cy={geometry.start.y} r={strokeWidth * 1.6} fill={colors.success} />
          <Circle cx={geometry.end.x} cy={geometry.end.y} r={strokeWidth * 1.6} fill={colors.accent} />
        </>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: 'transparent',
  },
});
