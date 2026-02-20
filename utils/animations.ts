import {
    Easing,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';

export const animations = {
  // Smooth spring animation
  spring: (toValue: number) => {
    return withSpring(toValue, {
      damping: 15,
      stiffness: 150,
      mass: 1,
    });
  },

  // Quick timing animation
  timing: (toValue: number, duration: number = 300) => {
    return withTiming(toValue, {
      duration,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  },

  // Bounce effect
  bounce: (toValue: number) => {
    return withSpring(toValue, {
      damping: 8,
      stiffness: 100,
      mass: 0.5,
    });
  },

  // Fade in
  fadeIn: (duration: number = 300) => {
    return withTiming(1, {
      duration,
      easing: Easing.ease,
    });
  },

  // Slide in from right
  slideInRight: (duration: number = 300) => {
    return withTiming(0, {
      duration,
      easing: Easing.out(Easing.ease),
    });
  },

  // Scale up
  scaleUp: (duration: number = 200) => {
    return withSequence(
      withTiming(1.05, { duration: duration / 2 }),
      withSpring(1, { damping: 10 })
    );
  },

  // Pulse animation
  pulse: () => {
    return withSequence(
      withTiming(1.1, { duration: 150 }),
      withTiming(1, { duration: 150 })
    );
  },
};