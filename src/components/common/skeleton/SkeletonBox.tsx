import React, { useEffect, useRef } from 'react';
import { Animated, type DimensionValue, type ViewStyle } from 'react-native';
import { useAppTheme } from '../../../theme/ThemeContext';

type Props = {
  width?: DimensionValue;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
};

export function SkeletonBox({
  width = '100%',
  height,
  borderRadius = 8,
  style,
}: Props) {
  const { colors } = useAppTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}
