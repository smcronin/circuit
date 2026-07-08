import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StyleProp,
  TextStyle,
  LayoutChangeEvent,
} from 'react-native';

interface MarqueeTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  pauseDuration?: number;
  scrollSpeed?: number;
}

export function MarqueeText({
  text,
  style,
  pauseDuration = 1000,
  scrollSpeed = 2,
}: MarqueeTextProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const overflow = textWidth - containerWidth;
  const shouldScroll = containerWidth > 0 && textWidth > 0 && overflow > 0;

  useEffect(() => {
    // Clear any existing animation
    if (animationRef.current) {
      clearTimeout(animationRef.current);
      animationRef.current = null;
    }

    if (!shouldScroll || !scrollViewRef.current) {
      // Reset to start position
      scrollViewRef.current?.scrollTo({ x: 0, animated: false });
      return;
    }

    const scrollDuration = (overflow / scrollSpeed) * 400;
    let direction = 1;

    const animateStep = () => {
      if (!scrollViewRef.current) return;

      const targetX = direction === 1 ? overflow : 0;
      scrollViewRef.current.scrollTo({ x: targetX, animated: true });

      // Wait for scroll to complete, then pause, then reverse
      animationRef.current = setTimeout(() => {
        animationRef.current = setTimeout(() => {
          direction = direction === 1 ? -1 : 1;
          animateStep();
        }, pauseDuration);
      }, scrollDuration);
    };

    // Initial pause before starting animation
    animationRef.current = setTimeout(animateStep, pauseDuration);

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [shouldScroll, overflow, pauseDuration, scrollSpeed]);

  const onContainerLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };

  const onTextLayout = (event: LayoutChangeEvent) => {
    setTextWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      style={[styles.container, !shouldScroll && styles.centered]}
      onLayout={onContainerLayout}
    >
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
      >
        <Text style={style} onLayout={onTextLayout}>
          {text}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    width: '100%',
  },
  centered: {
    alignItems: 'center',
  },
});
