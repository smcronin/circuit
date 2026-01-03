import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextStyle,
  LayoutChangeEvent,
} from 'react-native';

interface VerticalAutoScrollProps {
  text: string;
  style?: TextStyle;
  containerHeight: number;
  lineHeight?: number;
  pauseDuration?: number;
}

export function VerticalAutoScroll({
  text,
  style,
  containerHeight,
  lineHeight = 22,
  pauseDuration = 3000,
}: VerticalAutoScrollProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentLineRef = useRef(0);

  const overflow = contentHeight - containerHeight;
  const shouldScroll = contentHeight > 0 && overflow > 0;
  const totalLines = Math.ceil(overflow / lineHeight);

  useEffect(() => {
    // Clear any existing animation
    if (animationRef.current) {
      clearTimeout(animationRef.current);
      animationRef.current = null;
    }

    // Reset scroll position
    currentLineRef.current = 0;
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });

    if (!shouldScroll || !scrollViewRef.current) {
      return;
    }

    const scrollToNextLine = () => {
      if (!scrollViewRef.current) return;

      currentLineRef.current++;

      if (currentLineRef.current > totalLines) {
        // Reached the end, pause then scroll back to top
        animationRef.current = setTimeout(() => {
          currentLineRef.current = 0;
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });

          // After scrolling to top, pause then start again
          animationRef.current = setTimeout(() => {
            scrollToNextLine();
          }, pauseDuration);
        }, pauseDuration);
      } else {
        // Scroll to next line
        const targetY = currentLineRef.current * lineHeight;
        scrollViewRef.current.scrollTo({ y: targetY, animated: true });

        // Schedule next line scroll
        animationRef.current = setTimeout(scrollToNextLine, pauseDuration);
      }
    };

    // Initial pause before starting animation
    animationRef.current = setTimeout(scrollToNextLine, pauseDuration);

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [shouldScroll, overflow, totalLines, lineHeight, pauseDuration, text]);

  const onContentLayout = (event: LayoutChangeEvent) => {
    setContentHeight(event.nativeEvent.layout.height);
  };

  return (
    <View style={[styles.container, { height: containerHeight }]}>
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      >
        <Text
          style={[style, { lineHeight }]}
          onLayout={onContentLayout}
        >
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
});
