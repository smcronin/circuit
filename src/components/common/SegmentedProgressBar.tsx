import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, useWindowDimensions } from 'react-native';
import { borderRadius, spacing } from '@/theme';
import { TimerItem } from '@/types/workout';

interface SegmentedProgressBarProps {
  items: TimerItem[];
  currentItemIndex: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

// Fill colors for each segment (progress indicator)
const SEGMENT_FILL_COLORS = {
  warmup: '#FFC53D', // amber — ignition
  main: '#FFFFFF', // white
  cooldown: '#7DE3FC', // ice blue — wind down
};

// Background track colors (unfilled portion)
const SEGMENT_TRACK_COLORS = {
  warmup: 'rgba(255, 197, 61, 0.28)', // amber dimmed
  main: 'rgba(255, 255, 255, 0.28)', // white dimmed
  cooldown: 'rgba(125, 227, 252, 0.28)', // ice blue dimmed
};

function getSegmentType(item: TimerItem): 'warmup' | 'main' | 'cooldown' {
  if (item.type === 'warmup_exercise') return 'warmup';
  if (item.type === 'cooldown_exercise') return 'cooldown';
  return 'main';
}

interface Segment {
  type: 'warmup' | 'main' | 'cooldown';
  startIndex: number;
  endIndex: number;
  itemCount: number;
}

function calculateSegments(items: TimerItem[]): Segment[] {
  if (items.length === 0) return [];

  const segments: Segment[] = [];
  let currentSegment: Segment | null = null;

  items.forEach((item, index) => {
    const segmentType = getSegmentType(item);

    if (!currentSegment || currentSegment.type !== segmentType) {
      if (currentSegment) {
        segments.push(currentSegment);
      }
      currentSegment = {
        type: segmentType,
        startIndex: index,
        endIndex: index,
        itemCount: 1,
      };
    } else {
      currentSegment.endIndex = index;
      currentSegment.itemCount++;
    }
  });

  if (currentSegment) {
    segments.push(currentSegment);
  }

  return segments;
}

export function SegmentedProgressBar({
  items,
  currentItemIndex,
  height = 6,
  style,
}: SegmentedProgressBarProps) {
  const { width: windowWidth } = useWindowDimensions();
  const segments = calculateSegments(items);
  const totalItems = items.length;

  if (totalItems === 0) return null;

  // Calculate actual available width (screen width minus horizontal margins)
  // Default margin is spacing.lg (24) on each side
  const horizontalMargin = spacing.lg;
  const availableWidth = windowWidth - (horizontalMargin * 2);

  return (
    <View style={[styles.container, { height, width: availableWidth }, style]}>
      {segments.map((segment, index) => {
        // Calculate this segment's width in pixels
        const segmentWidth = (segment.itemCount / totalItems) * availableWidth;

        // Calculate fill percentage within this segment
        let fillPercent = 0;
        if (currentItemIndex > segment.endIndex) {
          fillPercent = 100;
        } else if (currentItemIndex >= segment.startIndex && currentItemIndex <= segment.endIndex) {
          const itemsCompletedInSegment = currentItemIndex - segment.startIndex;
          fillPercent = (itemsCompletedInSegment / segment.itemCount) * 100;
        }

        const isFirst = index === 0;
        const isLast = index === segments.length - 1;

        return (
          <View
            key={`${segment.type}-${index}`}
            style={[
              styles.segment,
              {
                width: segmentWidth,
                backgroundColor: SEGMENT_TRACK_COLORS[segment.type],
              },
              isFirst && styles.firstSegment,
              isLast && styles.lastSegment,
            ]}
          >
            <View
              style={[
                styles.fill,
                {
                  width: `${fillPercent}%`,
                  backgroundColor: SEGMENT_FILL_COLORS[segment.type],
                },
                isFirst && styles.firstFill,
                isLast && fillPercent === 100 && styles.lastFill,
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  segment: {
    height: '100%',
    overflow: 'hidden',
  },
  firstSegment: {
    borderTopLeftRadius: borderRadius.full,
    borderBottomLeftRadius: borderRadius.full,
  },
  lastSegment: {
    borderTopRightRadius: borderRadius.full,
    borderBottomRightRadius: borderRadius.full,
  },
  fill: {
    height: '100%',
  },
  firstFill: {
    borderTopLeftRadius: borderRadius.full,
    borderBottomLeftRadius: borderRadius.full,
  },
  lastFill: {
    borderTopRightRadius: borderRadius.full,
    borderBottomRightRadius: borderRadius.full,
  },
});
