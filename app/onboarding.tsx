import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../firebase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Slide definitions ────────────────────────────────────────────────────────
const SLIDES = [
  {
    id: '1',
    icon: '🔍',
    title: 'Find the Right Provider',
    description:
      'Search 200+ Oklahoma healthcare providers by specialty, location, or insurance. Filter by SoonerCare and Medicaid acceptance in one tap.',
    accent: '#4facfe',
  },
  {
    id: '2',
    icon: '💊',
    title: 'Insurance Made Simple',
    description:
      'See upfront which providers accept your coverage. No more calling offices — SoonerCare, Medicaid, and more are all clearly labeled.',
    accent: '#00d2a0',
  },
  {
    id: '3',
    icon: '📅',
    title: 'Book in Seconds',
    description:
      'Request appointments directly through the app. Pick a date, add notes, and get confirmation — all without a phone call.',
    accent: '#f093fb',
  },
  {
    id: '4',
    icon: '👤',
    title: 'Your Health, Your Profile',
    description:
      'Save your favorite providers, manage your insurance info, and track your appointments all in one place. Healthcare that works for you.',
    accent: '#f59e0b',
  },
];

// ─── Single slide ─────────────────────────────────────────────────────────────
function Slide({
  item,
  colors,
}: {
  item: typeof SLIDES[0];
  colors: any;
}) {
  return (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      <View style={[
        styles.iconBubble,
        { backgroundColor: item.accent + '20', borderColor: item.accent + '40' },
      ]}>
        <Text style={styles.icon}>{item.icon}</Text>
      </View>
      <Text style={[styles.slideTitle, { color: colors.text }]}>{item.title}</Text>
      <Text style={[styles.slideDescription, { color: colors.subtext }]}>
        {item.description}
      </Text>
    </View>
  );
}

// ─── Main onboarding screen ───────────────────────────────────────────────────
export default function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const isLastSlide = currentIndex === SLIDES.length - 1;

  const handleFinish = async () => {
    try {
      // Per-user key so multiple accounts on same device each get onboarding
      const uid = auth.currentUser?.uid;
      const key = uid ? `onboardingComplete_${uid}` : 'onboardingComplete';
      await AsyncStorage.setItem(key, 'true');
    } catch {
      // non-critical — worst case they see onboarding again next launch
    }
    router.replace('/(tabs)');
  };

  const handleNext = () => {
    if (isLastSlide) {
      handleFinish();
      return;
    }
    const next = currentIndex + 1;
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
    setCurrentIndex(next);
  };

  const handleSkip = () => {
    handleFinish();
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Skip button */}
      {!isLastSlide && (
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
        >
          <Text style={[styles.skipText, { color: colors.subtext }]}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <Slide item={item} colors={colors} />}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        scrollEventThrottle={16}
        style={styles.flatList}
      />

      {/* Bottom controls */}
      <View style={styles.controls}>
        {/* Pagination dots */}
        <View style={styles.pagination}>
          {SLIDES.map((slide, index) => {
            const inputRange = [
              (index - 1) * SCREEN_WIDTH,
              index * SCREEN_WIDTH,
              (index + 1) * SCREEN_WIDTH,
            ];

            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });

            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={slide.id}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    opacity,
                    backgroundColor: SLIDES[currentIndex].accent,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Next / Get Started button */}
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: SLIDES[currentIndex].accent }]}
          onPress={handleNext}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isLastSlide ? 'Get started' : 'Next slide'}
        >
          <Text style={styles.nextButtonText}>
            {isLastSlide ? 'Get Started 🎉' : 'Next →'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipButton: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skipText: { fontSize: 15, fontWeight: '500' },
  flatList: { flex: 1 },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingTop: 80,
    paddingBottom: 20,
  },
  iconBubble: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  icon: { fontSize: 52 },
  slideTitle: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 34,
  },
  slideDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 320,
  },
  controls: {
    paddingHorizontal: 28,
    paddingBottom: 52,
    paddingTop: 16,
    gap: 24,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: { height: 8, borderRadius: 4 },
  nextButton: {
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
