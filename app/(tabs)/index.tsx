import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
  Alert,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { auth, db } from '../../firebase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// CATEGORY DEFINITIONS WITH ICONS & COLORS
// ============================================
const CATEGORY_CONFIG: Record<string, { icon: string; color: string; searchTerms: string[] }> = {
  'Primary Care': {
    icon: '👨‍⚕️',
    color: '#4CAF50',
    searchTerms: ['primary care', 'family medicine', 'general practice', 'internal medicine'],
  },
  'Urgent Care': {
    icon: '🚑',
    color: '#F44336',
    searchTerms: ['urgent care', 'emergency', 'walk-in'],
  },
  'Cardiology': {
    icon: '❤️',
    color: '#E91E63',
    searchTerms: ['cardiology', 'cardiologist', 'heart'],
  },
  'Mental Health': {
    icon: '🧠',
    color: '#9C27B0',
    searchTerms: ['mental health', 'psychiatry', 'psychology', 'therapist', 'counselor', 'behavioral'],
  },
  'Women\'s Health': {
    icon: '🤰',
    color: '#FF4081',
    searchTerms: ['obgyn', 'gynecology', 'obstetrics', 'women\'s health', 'ob/gyn'],
  },
  'Pediatrics': {
    icon: '👶',
    color: '#FF9800',
    searchTerms: ['pediatric', 'pediatrics', 'children', 'kids'],
  },
  'Dental': {
    icon: '🦷',
    color: '#00BCD4',
    searchTerms: ['dental', 'dentist', 'orthodontic'],
  },
  'Vision': {
    icon: '👁️',
    color: '#607D8B',
    searchTerms: ['vision', 'optometry', 'ophthalmology', 'eye'],
  },
  'Dermatology': {
    icon: '🩺',
    color: '#795548',
    searchTerms: ['dermatology', 'dermatologist', 'skin'],
  },
  'Orthopedics': {
    icon: '🦴',
    color: '#3F51B5',
    searchTerms: ['orthopedic', 'orthopedics', 'bone', 'joint'],
  },
};

interface Provider {
  id: string;
  name: string;
  specialty: string;
  address: string;
  phone: string;
  rating: number;
  acceptsNewPatients?: boolean;
  acceptingNewPatients?: boolean;
  location?: {
    latitude: number;
    longitude: number;
  };
  latitude?: number;
  longitude?: number;
  insuranceAccepted: string[];
  category?: string;
  categories?: string[];
  city?: string;
  state?: string;
  verified?: boolean;
}

interface CategoryData {
  id: string;
  name: string;
  icon: string;
  color: string;
  searchTerms: string[];
  count: number;
}

// ============================================
// COMPACT CATEGORY CAROUSEL COMPONENT
// ============================================
const CompactCategoryCarousel = ({
  categories,
  onSelectCategory,
  colors,
}: {
  categories: CategoryData[];
  onSelectCategory: (searchTerm: string, categoryName: string) => void;
  colors: any;
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Compact card dimensions
  const COMPACT_CARD_WIDTH = SCREEN_WIDTH * 0.45;
  const COMPACT_SPACING = 12;

  // Auto-scroll every 4 seconds
  useEffect(() => {
    if (isPaused || categories.length === 0) return;

    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % categories.length;
      scrollViewRef.current?.scrollTo({
        x: nextIndex * (COMPACT_CARD_WIDTH + COMPACT_SPACING),
        animated: true,
      });
      setCurrentIndex(nextIndex);
    }, 4000);

    return () => clearInterval(interval);
  }, [currentIndex, isPaused, categories.length]);

  if (categories.length === 0) {
    return null;
  }

  return (
    <View style={styles.compactCategoriesWrapper}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.compactCategoriesScroll}
        nestedScrollEnabled={true}
        onScrollBeginDrag={() => setIsPaused(true)}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(
            e.nativeEvent.contentOffset.x / (COMPACT_CARD_WIDTH + COMPACT_SPACING)
          );
          setCurrentIndex(newIndex);
          setTimeout(() => setIsPaused(false), 8000);
        }}
      >
        {categories.map((category, index) => {
          const isActive = index === currentIndex;

          return (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.compactCategoryCard,
                {
                  width: COMPACT_CARD_WIDTH,
                  backgroundColor: colors.card,
                  borderColor: isActive ? category.color : colors.border,
                  borderWidth: isActive ? 2 : 1,
                },
              ]}
              onPress={() => {
                setIsPaused(true);
                onSelectCategory(category.searchTerms[0], category.name);
              }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.compactIconContainer,
                  { backgroundColor: category.color + '20' },
                ]}
              >
                <Text style={styles.compactIcon}>{category.icon}</Text>
              </View>

              <Text
                style={[styles.compactCategoryName, { color: colors.text }]}
                numberOfLines={1}
              >
                {category.name}
              </Text>
              <Text style={[styles.compactProviderCount, { color: colors.subtext }]}>
                {category.count} providers
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.compactPagination}>
        {categories.slice(0, 5).map((_, index) => (
          <View
            key={index}
            style={[
              styles.compactPaginationDot,
              {
                backgroundColor:
                  index === currentIndex ? colors.primary : colors.border,
                width: index === currentIndex ? 16 : 6,
              },
            ]}
          />
        ))}
        {categories.length > 5 && (
          <Text style={[styles.moreIndicator, { color: colors.subtext }]}>
            +{categories.length - 5}
          </Text>
        )}
      </View>
    </View>
  );
};

// ============================================
// MAIN HOME SCREEN
// ============================================
export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [providers, setProviders] = useState<Provider[]>([]);
  const [filteredProviders, setFilteredProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>('');
  const [showInsuranceFilter, setShowInsuranceFilter] = useState(false);
  const [userName, setUserName] = useState('');
  const [availableCategories, setAvailableCategories] = useState<string[]>(['all']);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [disclaimerHeight] = useState(new Animated.Value(1));

  useEffect(() => {
    loadProviders();
    loadUserName();
    loadDisclaimerPreference();
  }, []);

  useEffect(() => {
    filterProviders();
  }, [providers, searchQuery, selectedCategory, showInsuranceFilter]);

  const loadDisclaimerPreference = async () => {
    try {
      const dismissed = await AsyncStorage.getItem('disclaimerDismissed');
      if (dismissed === 'true') {
        setShowDisclaimer(false);
      }
    } catch (error) {
      console.log('Could not load disclaimer preference:', error);
    }
  };

  const handleDismissDisclaimer = async () => {
    try {
      Animated.timing(disclaimerHeight, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        setShowDisclaimer(false);
      });
      await AsyncStorage.setItem('disclaimerDismissed', 'true');
    } catch (error) {
      console.log('Could not save disclaimer preference:', error);
    }
  };

  const loadUserName = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const email = userDoc.data().email || user.email;
        if (email) {
          const name = email.split('@')[0];
          setUserName(name.charAt(0).toUpperCase() + name.slice(1));
        }
      }
    } catch (error) {
      console.log('Could not load user name:', error);
    }
  };

  const loadProviders = useCallback(async () => {
    try {
      setLoading(true);

      console.log('🔄 Starting to load providers...');

      let querySnapshot;
      try {
        const providersQuery = query(collection(db, 'providers'));
        querySnapshot = await getDocs(providersQuery);
      } catch (firestoreError) {
        console.error('❌ Firestore error:', firestoreError);
        Alert.alert(
          'Network Error',
          'Could not load providers. Please check your internet connection.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      const providersList: Provider[] = [];
      const specialtiesSet = new Set<string>();
      let validCount = 0;
      let skippedCount = 0;

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();

        if (!data.name || !data.specialty) {
          console.warn(`⚠️ Skipping provider ${docSnap.id} - missing required fields:`, {
            hasName: !!data.name,
            hasSpecialty: !!data.specialty,
          });
          skippedCount++;
          return;
        }

        let safeRating = 0;
        if (typeof data.rating === 'number') {
          safeRating = data.rating;
        } else if (typeof data.rating === 'string') {
          const parsed = parseFloat(data.rating);
          safeRating = isNaN(parsed) ? 0 : parsed;
        }

        let safeLatitude = 35.4676;
        let safeLongitude = -97.5164;

        if (typeof data.latitude === 'number' && data.latitude !== 0) {
          safeLatitude = data.latitude;
        }
        if (typeof data.longitude === 'number' && data.longitude !== 0) {
          safeLongitude = data.longitude;
        }

        let safeInsurance: string[] = [];
        if (Array.isArray(data.insuranceAccepted)) {
          safeInsurance = data.insuranceAccepted;
        } else if (typeof data.insuranceAccepted === 'string') {
          safeInsurance = [data.insuranceAccepted];
        }

        let safeCategories: string[] = [];
        if (Array.isArray(data.categories)) {
          safeCategories = data.categories;
        } else if (data.category) {
          safeCategories = [data.category];
        }

        const safeProvider: Provider = {
          id: docSnap.id,
          name: data.name,
          specialty: data.specialty,
          address: data.address || '',
          phone: data.phone || '',
          rating: safeRating,
          acceptsNewPatients: data.acceptingNewPatients ?? data.acceptsNewPatients ?? true,
          location: {
            latitude: safeLatitude,
            longitude: safeLongitude,
          },
          latitude: safeLatitude,
          longitude: safeLongitude,
          insuranceAccepted: safeInsurance,
          category: data.category || '',
          categories: safeCategories,
          city: data.city || '',
          state: data.state || 'Oklahoma',
          verified: data.verified ?? false,
        };

        providersList.push(safeProvider);
        validCount++;

        if (data.specialty) {
          specialtiesSet.add(data.specialty);
        }
      });

      console.log(`✅ Loaded ${validCount} valid providers, skipped ${skippedCount} invalid`);

      // 🆕 DEBUG: Show first 3 provider IDs
      console.log('📋 First 3 provider IDs:', providersList.slice(0, 3).map(p => ({
        id: p.id,
        name: p.name
      })));

      setProviders(providersList);

      const categoriesWithCounts: CategoryData[] = [];

      Object.entries(CATEGORY_CONFIG).forEach(([categoryName, config]) => {
        const count = providersList.filter((p) => {
          const specialty = p.specialty.toLowerCase();
          const cat = p.category?.toLowerCase() || '';
          const cats = p.categories?.map((c) => c.toLowerCase()) || [];

          return config.searchTerms.some(
            (term) =>
              specialty.includes(term.toLowerCase()) ||
              cat.includes(term.toLowerCase()) ||
              cats.some((c) => c.includes(term.toLowerCase()))
          );
        }).length;

        if (count > 0) {
          categoriesWithCounts.push({
            id: categoryName.replace(/\s+/g, '-').toLowerCase(),
            name: categoryName,
            icon: config.icon,
            color: config.color,
            searchTerms: config.searchTerms,
            count,
          });
        }
      });

      categoriesWithCounts.sort((a, b) => b.count - a.count);

      setCategoryData(categoriesWithCounts);

      const cats = ['all', ...Array.from(specialtiesSet)].slice(0, 8);
      setAvailableCategories(cats);
    } catch (error) {
      console.error('❌ Unexpected error in loadProviders:', error);
      Alert.alert('Error', 'Failed to load providers. Please try again.', [
        { text: 'Retry', onPress: () => loadProviders() },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  const filterProviders = () => {
    if (!providers) return;

    let filtered = [...providers];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(query)) ||
          (p.specialty && p.specialty.toLowerCase().includes(query)) ||
          (p.address && p.address.toLowerCase().includes(query)) ||
          (p.city && p.city.toLowerCase().includes(query))
      );
    }

    if (selectedCategory && selectedCategory !== 'all') {
      const matchingCategory = Object.entries(CATEGORY_CONFIG).find(([name, config]) =>
        config.searchTerms.some((term) => term.toLowerCase() === selectedCategory.toLowerCase())
      );

      if (matchingCategory) {
        const [, config] = matchingCategory;
        filtered = filtered.filter((p) => {
          const specialty = p.specialty.toLowerCase();
          const cat = p.category?.toLowerCase() || '';
          const cats = p.categories?.map((c) => c.toLowerCase()) || [];

          return config.searchTerms.some(
            (term) =>
              specialty.includes(term.toLowerCase()) ||
              cat.includes(term.toLowerCase()) ||
              cats.some((c) => c.includes(term.toLowerCase()))
          );
        });
      } else {
        filtered = filtered.filter(
          (p) =>
            p.category === selectedCategory ||
            (p.categories && p.categories.includes(selectedCategory)) ||
            (p.specialty && p.specialty.toLowerCase().includes(selectedCategory.toLowerCase()))
        );
      }
    }

    if (showInsuranceFilter) {
      filtered = filtered.filter(
        (p) =>
          p.insuranceAccepted &&
          (p.insuranceAccepted.includes('SoonerCare') ||
            p.insuranceAccepted.includes('Medicaid'))
      );
    }

    setFilteredProviders(filtered);
  };

  const handleProviderPress = (providerId: string) => {
    try {
      if (!providerId || typeof providerId !== 'string') {
        console.error('Invalid provider ID:', providerId);
        Alert.alert('Error', 'Could not open provider details');
        return;
      }

      console.log('🔗 Navigating to provider:', providerId); // 🆕 DEBUG
      router.push(`/provider/${providerId}` as any);
    } catch (error) {
      console.error('Error navigating to provider:', error);
      Alert.alert('Error', 'Could not open provider details');
    }
  };

  const handleQuickSearch = (search: string) => {
    setSearchQuery(search);
    setSelectedCategory('all');
    setSelectedCategoryName('');
  };

  const handleCategorySelect = (searchTerm: string, categoryName: string) => {
    setSelectedCategory(searchTerm);
    setSelectedCategoryName(categoryName);
    setSearchQuery('');
  };

  const handleClearFilters = () => {
    setSelectedCategory('all');
    setSelectedCategoryName('');
    setSearchQuery('');
    setShowInsuranceFilter(false);
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          styles.centerContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading providers...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          {userName ? `Hi ${userName}` : 'Find Care'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>
          {providers.length}+ providers in Oklahoma
        </Text>
      </View>

      <View
        style={[
          styles.insuranceBanner,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.insuranceContent}>
          <Text style={styles.insuranceIcon}>💊</Text>
          <View style={styles.insuranceTextContainer}>
            <Text style={[styles.insuranceTitle, { color: colors.text }]}>
              Have SoonerCare or Medicaid?
            </Text>
            <Text style={[styles.insuranceSubtitle, { color: colors.subtext }]}>
              {showInsuranceFilter
                ? 'Showing providers accepting your coverage'
                : 'Filter to show only providers accepting your insurance'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.filterButton,
            { backgroundColor: showInsuranceFilter ? colors.success : colors.primary },
          ]}
          onPress={() => setShowInsuranceFilter(!showInsuranceFilter)}
        >
          <Text style={styles.filterButtonText}>
            {showInsuranceFilter ? '✓' : 'Filter'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by name, specialty, or location..."
            placeholderTextColor={colors.subtext}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {selectedCategoryName && selectedCategory !== 'all' && (
        <View style={styles.filterBadgeContainer}>
          <View style={[styles.filterBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.filterBadgeText}>Filtered by: {selectedCategoryName}</Text>
            <TouchableOpacity onPress={handleClearFilters}>
              <Ionicons name="close" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showDisclaimer && (
        <Animated.View
          style={[
            styles.disclaimerContainer,
            {
              backgroundColor: colors.card,
              opacity: disclaimerHeight,
              transform: [{ scaleY: disclaimerHeight }],
            },
          ]}
        >
          <View style={styles.disclaimerContent}>
            <Text style={styles.disclaimerIcon}>ℹ️</Text>
            <Text style={[styles.disclaimerText, { color: colors.subtext }]}>
              Provider info from public sources. Always verify insurance acceptance before
              booking.
            </Text>
            <TouchableOpacity onPress={handleDismissDisclaimer}>
              <Text style={styles.disclaimerClose}>✕</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {!searchQuery && selectedCategory === 'all' && categoryData.length > 0 && (
        <View style={styles.categoriesSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            🔥 Browse by Category
          </Text>
          <CompactCategoryCarousel
            categories={categoryData}
            onSelectCategory={handleCategorySelect}
            colors={colors}
          />
        </View>
      )}

      {!searchQuery && selectedCategory === 'all' && (
        <View style={styles.quickSearches}>
          <Text style={[styles.quickSearchTitle, { color: colors.text }]}>
            🔥 Popular Searches
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.quickSearchScroll}
            nestedScrollEnabled={true}
          >
            <TouchableOpacity
              style={[styles.quickSearchChip, { backgroundColor: colors.primary }]}
              onPress={() => handleQuickSearch('internal medicine')}
            >
              <Text style={styles.quickSearchText}>Internal Medicine</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickSearchChip, { backgroundColor: colors.primary }]}
              onPress={() => handleQuickSearch('oklahoma city')}
            >
              <Text style={styles.quickSearchText}>Oklahoma City</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickSearchChip, { backgroundColor: colors.primary }]}
              onPress={() => handleQuickSearch('family')}
            >
              <Text style={styles.quickSearchText}>Family Medicine</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickSearchChip, { backgroundColor: colors.primary }]}
              onPress={() => handleQuickSearch('pediatric')}
            >
              <Text style={styles.quickSearchText}>Pediatrics</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
          nestedScrollEnabled={true}
        >
          {availableCategories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    selectedCategory === category ? colors.primary : colors.card,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => {
                setSelectedCategory(category);
                setSelectedCategoryName(category === 'all' ? '' : category);
              }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: selectedCategory === category ? '#fff' : colors.text },
                ]}
              >
                {category === 'all' ? 'All Specialties' : category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.list}>
        {filteredProviders.length > 0 ? (
          filteredProviders.map((item) => {
            if (!item || !item.id) {
              return null;
            }

            const hasSoonerCare =
              item.insuranceAccepted.includes('SoonerCare') ||
              item.insuranceAccepted.includes('Medicaid');
            const acceptingPatients = item.acceptsNewPatients ?? item.acceptingNewPatients ?? true;
            const isVerified = item.verified ?? false;

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.providerCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => handleProviderPress(item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardLeft}>
                    <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                      <Text style={styles.avatarText}>{item.name ? item.name.charAt(0) : 'P'}</Text>
                    </View>
                  </View>

                  <View style={styles.cardContent}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.providerName, { color: colors.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {isVerified && (
                        <View style={[styles.verifiedBadge, { backgroundColor: colors.success }]}>
                          <Text style={styles.verifiedBadgeText}>✓</Text>
                        </View>
                      )}
                    </View>

                    <Text style={[styles.specialty, { color: colors.primary }]} numberOfLines={1}>
                      {item.specialty}
                    </Text>

                    {acceptingPatients && (
                      <View style={[styles.availableBadge, { backgroundColor: colors.success }]}>
                        <Text style={styles.availableText}>✅ Accepting patients</Text>
                      </View>
                    )}

                    {hasSoonerCare && (
                      <View style={[styles.soonerCareBadge, { backgroundColor: '#E8F5E9' }]}>
                        <Text style={[styles.soonerCareText, { color: colors.success }]}>
                          💊 SoonerCare
                        </Text>
                      </View>
                    )}

                    <View style={styles.ratingRow}>
                      <Text style={styles.star}>⭐</Text>
                      <Text style={[styles.rating, { color: colors.text }]}>
                        {item.rating.toFixed(1)}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Providers Found</Text>
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              {searchQuery
                ? `No results for "${searchQuery}"`
                : 'Try adjusting your filters'}
            </Text>

            <TouchableOpacity
              style={[styles.clearButton, { backgroundColor: colors.primary }]}
              onPress={handleClearFilters}
            >
              <Text style={styles.clearButtonText}>Clear All Filters</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
  },
  insuranceBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  insuranceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  insuranceIcon: {
    fontSize: 28,
    marginRight: 10,
  },
  insuranceTextContainer: {
    flex: 1,
  },
  insuranceTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  insuranceSubtitle: {
    fontSize: 11,
    lineHeight: 14,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginLeft: 10,
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  clearIcon: {
    fontSize: 18,
    color: '#999',
    padding: 4,
  },
  filterBadgeContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  disclaimerContainer: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  disclaimerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  disclaimerIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 14,
  },
  disclaimerClose: {
    fontSize: 18,
    color: '#999',
    padding: 4,
  },
  categoriesSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  compactCategoriesWrapper: {
    marginBottom: 8,
    paddingVertical: 4,
  },
  compactCategoriesScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  compactCategoryCard: {
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginRight: 0,
  },
  compactIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  compactIcon: {
    fontSize: 20,
  },
  compactCategoryName: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  compactProviderCount: {
    fontSize: 10,
  },
  compactPagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  compactPaginationDot: {
    height: 6,
    borderRadius: 3,
  },
  moreIndicator: {
    fontSize: 10,
    marginLeft: 4,
  },
  quickSearches: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  quickSearchTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  quickSearchScroll: {
    flexDirection: 'row',
  },
  quickSearchChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  quickSearchText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  filtersContainer: {
    marginBottom: 10,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingTop: 0,
  },
  providerCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLeft: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  cardContent: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  providerName: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  specialty: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  availableBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  availableText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  soonerCareBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  soonerCareText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  star: {
    fontSize: 14,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
  },
  chevron: {
    fontSize: 24,
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  clearButton: {
    marginTop: 20,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
