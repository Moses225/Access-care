import { useRouter } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { SlideInRight } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { db } from '../../firebase';

interface Provider {
  id: string;
  name: string;
  specialty: string;
  category: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  rating: number;
  reviewCount: number;
  acceptingNewPatients: boolean;
}

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [filteredProviders, setFilteredProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('All');

  const categories = ['All', 'Core', 'Extended', 'Rare'];

  const specialtyMap: { [key: string]: string[] } = {
    All: ['All'],
    Core: ['All', 'OB/GYN', 'Pediatrics', 'Family Medicine'],
    Extended: [
      'All',
      'Doula Services',
      'Mental Health Counselor',
      'Dietitian',
      'Home Health Agency',
      'Lactation Consultant',
      'Physical Therapy',
      'Chiropractic',
      'Midwifery',
      'Dermatology',
    ],
    Rare: ['All', 'Reproductive Endocrinology', 'Genetic Counseling', 'Neonatology'],
  };

  const availableSpecialties = specialtyMap[selectedCategory] || ['All'];

  useEffect(() => {
    loadProviders();
  }, []);

  useEffect(() => {
    filterProviders();
  }, [searchQuery, selectedCategory, selectedSpecialty, providers]);

  const loadProviders = async () => {
    try {
      console.log('🔄 Loading providers...');
      console.log('🔄 Fetching providers from Firebase...');

      const querySnapshot = await getDocs(collection(db, 'providers'));

      console.log('📊 Found', querySnapshot.size, 'providers in Firebase');

      const providerData = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Unknown Provider',
          specialty: data.specialty || 'Unknown',
          category: data.category || 'Extended',
          address: data.address || '',
          city: data.city || '',
          state: data.state || 'OK',
          zip: data.zip || '',
          phone: data.phone || '',
          rating: data.rating || 4.5,
          reviewCount: data.reviewCount || 0,
          acceptingNewPatients: data.acceptingNewPatients !== false,
        };
      });

      console.log('✅ Successfully loaded providers:', providerData.length);
      setProviders(providerData);
      setFilteredProviders(providerData);
    } catch (error) {
      console.error('❌ Error loading providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterProviders = () => {
    let filtered = [...providers];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (provider) =>
          provider.name.toLowerCase().includes(query) ||
          provider.specialty.toLowerCase().includes(query)
      );
    }

    if (selectedCategory !== 'All') {
      filtered = filtered.filter((provider) => provider.category === selectedCategory);
    }

    if (selectedSpecialty !== 'All') {
      filtered = filtered.filter((provider) => provider.specialty === selectedSpecialty);
    }

    console.log('✅ Loaded providers:', filtered.length);
    setFilteredProviders(filtered);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSelectedSpecialty('All');
  };

  const renderProvider = ({ item, index }: { item: Provider; index: number }) => (
    <Animated.View entering={SlideInRight.delay(index * 50).duration(500).springify()}>
      <TouchableOpacity
        style={[styles.providerCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push(`/provider/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={[styles.providerAvatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>
            {item.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)}
          </Text>
        </View>

        <View style={styles.providerInfo}>
          <Text style={[styles.providerName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.providerSpecialty, { color: colors.primary }]} numberOfLines={1}>
            {item.specialty}
          </Text>

          <View style={styles.providerMeta}>
            <View style={styles.ratingContainer}>
              <Text style={styles.ratingIcon}>⭐</Text>
              <Text style={[styles.rating, { color: colors.text }]}>{item.rating}</Text>
              {item.reviewCount > 0 && (
                <Text style={[styles.reviewCount, { color: colors.subtext }]}>
                  ({item.reviewCount})
                </Text>
              )}
            </View>
          </View>

          {/* SoonerCare Badge */}
          <View style={[styles.soonerCareBadge, { backgroundColor: colors.success }]}>
            <Text style={styles.badgeIcon}>✅</Text>
            <Text style={styles.badgeText}>SoonerCare</Text>
          </View>
        </View>

        <View style={styles.providerAction}>
          <Text style={[styles.viewDetails, { color: colors.primary }]}>View Details →</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading providers...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <Text style={[styles.title, { color: colors.primary }]}>🤰 Find Your Provider</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>
          {filteredProviders.length} Oklahoma providers ready to help
        </Text>
      </View>

      {/* SoonerCare Quick Access Banner */}
      <View style={[styles.soonerCareBanner, { backgroundColor: colors.primary }]}>
        <View style={styles.soonerCareContent}>
          <Text style={styles.soonerCareIcon}>✅</Text>
          <View style={styles.soonerCareText}>
            <Text style={styles.soonerCareTitle}>All Providers Accept SoonerCare</Text>
            <Text style={styles.soonerCareSubtitle}>
              Find care you can afford - 199 providers ready to help
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={[
            styles.searchBar,
            { backgroundColor: colors.card, color: colors.text, borderColor: colors.border },
          ]}
          placeholder="Search by name or specialty..."
          placeholderTextColor={colors.subtext}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filterSection}>
        <View style={styles.filterHeader}>
          <Text style={[styles.filterLabel, { color: colors.text }]}>Category</Text>
          {(selectedCategory !== 'All' || selectedSpecialty !== 'All' || searchQuery) && (
            <TouchableOpacity onPress={clearFilters}>
              <Text style={[styles.clearFilters, { color: colors.primary }]}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.filterChip,
                { borderColor: colors.primary, backgroundColor: colors.background },
                selectedCategory === category && { backgroundColor: colors.primary },
              ]}
              onPress={() => {
                setSelectedCategory(category);
                setSelectedSpecialty('All');
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: selectedCategory === category ? '#fff' : colors.primary },
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.filterSection}>
        <Text style={[styles.filterLabel, { color: colors.text }]}>Specialty</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {availableSpecialties.map((specialty) => (
            <TouchableOpacity
              key={specialty}
              style={[
                styles.filterChip,
                { borderColor: colors.primary, backgroundColor: colors.background },
                selectedSpecialty === specialty && { backgroundColor: colors.primary },
              ]}
              onPress={() => setSelectedSpecialty(specialty)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: selectedSpecialty === specialty ? '#fff' : colors.primary },
                ]}
              >
                {specialty}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredProviders}
        renderItem={renderProvider}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Providers Found</Text>
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              Try adjusting your search or filters
            </Text>
            <TouchableOpacity
              style={[styles.clearButton, { backgroundColor: colors.primary }]}
              onPress={clearFilters}
            >
              <Text style={styles.clearButtonText}>Clear Filters</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
  },
  soonerCareBanner: {
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  soonerCareContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  soonerCareIcon: {
    fontSize: 40,
    marginRight: 16,
  },
  soonerCareText: {
    flex: 1,
  },
  soonerCareTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  soonerCareSubtitle: {
    color: '#fff',
    fontSize: 13,
    opacity: 0.95,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchBar: {
    padding: 14,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  filterSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  clearFilters: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterScroll: {
    marginTop: 8,
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    marginRight: 10,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingTop: 0,
  },
  providerCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  providerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  providerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  providerName: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  providerSpecialty: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  providerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  reviewCount: {
    fontSize: 12,
  },
  soonerCareBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
  },
  badgeIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  providerAction: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  viewDetails: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  clearButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});