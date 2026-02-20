import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';

export function ProviderCardSkeleton() {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0.3, { duration: 1000 })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Animated.View
        style={[
          styles.badge,
          { backgroundColor: colors.border },
          animatedStyle,
        ]}
      />
      <View style={styles.header}>
        <Animated.View
          style={[
            styles.avatar,
            { backgroundColor: colors.border },
            animatedStyle,
          ]}
        />
        <View style={styles.info}>
          <Animated.View
            style={[
              styles.titleSkeleton,
              { backgroundColor: colors.border },
              animatedStyle,
            ]}
          />
          <Animated.View
            style={[
              styles.subtitleSkeleton,
              { backgroundColor: colors.border },
              animatedStyle,
            ]}
          />
        </View>
      </View>
      <Animated.View
        style={[
          styles.buttonSkeleton,
          { backgroundColor: colors.border },
          animatedStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 2,
  },
  badge: {
    width: 80,
    height: 24,
    borderRadius: 12,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  titleSkeleton: {
    width: '70%',
    height: 18,
    borderRadius: 4,
    marginBottom: 8,
  },
  subtitleSkeleton: {
    width: '50%',
    height: 14,
    borderRadius: 4,
  },
  buttonSkeleton: {
    width: '100%',
    height: 44,
    borderRadius: 8,
  },
});