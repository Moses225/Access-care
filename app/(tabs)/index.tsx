import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query } from 'firebase/firestore';
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
import { DataDisclaimer } from '../../components/DataDisclaimer';
import { useTheme } from '../../context/ThemeContext';
import { auth, db } from '../../firebase';

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

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  
  const [providers, setProviders] = useState<Provider[]>([]);
  const [filteredProviders, setFilteredProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showInsuranceFilter, setShowInsuranceFilter] = useState(false);
  const [userName, setUserName] = useState('');
  const [availableCategories, setAvailableCategories] = useState<string[]>(['all']);

  useEffect(() => {
    loadProviders();
    loadUserName();
  }, []);

  useEffect(() => {
    filterProviders();
  }, [providers, searchQuery, selectedCategory, showInsuranceFilter]);

  const loadUserName = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const email = userDoc.data().email || user.email;
          if (email) {
            const name = email.split('@')[0];
            setUserName(name.charAt(0).toUpperCase() + name.slice(1));
          }
        }
      }
    } catch (error) {
      console.log('Could not load user name:', error);
    }
  };

  const loadProviders = async () => {
    try {
      setLoading(true);
      const providersQuery = query(collection(db, 'providers'));
      const querySnapshot = await getDocs(providersQuery);
      
      const providersList: Provider[] = [];
      const specialtiesSet = new Set<string>();
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        if (data.name && data.specialty) {
          providersList.push({
            id: doc.id,
            name: data.name,
            specialty: data.specialty,
            address: data.address || '',
            phone: data.phone || '',
            rating: data.rating || 0,
            acceptsNewPatients: data.acceptingNewPatients ?? data.acceptsNewPatients ?? true,
            location: data.latitude && data.longitude 
              ? { latitude: data.latitude, longitude: data.longitude }
              : undefined,
            latitude: data.latitude,
            longitude: data.longitude,
            insuranceAccepted: Array.isArray(data.insuranceAccepted) ? data.insuranceAccepted : [],
            category: data.category || '',
            categories: Array.isArray(data.categories) ? data.categories : (data.category ? [data.category] : []),
            city: data.city || '',
            state: data.state || 'Oklahoma',
            verified: data.verified ?? false,
          });
          
          if (data.specialty) {
            specialtiesSet.add(data.specialty);
          }
        }
      });
      
      setProviders(providersList);
      
      const cats = ['all', ...Array.from(specialtiesSet)].slice(0, 6);
      setAvailableCategories(cats);
      
      console.log(`Loaded ${providersList.length} providers with specialties:`, Array.from(specialtiesSet));
    } catch (error) {
      console.error('Error loading providers:', error);
    } finally {
      setLoading(false);
    }
  };

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
      filtered = filtered.filter(
        (p) =>
          p.category === selectedCategory ||
          (p.categories && p.categories.includes(selectedCategory)) ||
          (p.specialty && p.specialty.toLowerCase().includes(selectedCategory.toLowerCase()))
      );
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
    router.push(`/provider/${providerId}` as any);
  };

  const handleQuickSearch = (search: string) => {
    setSearchQuery(search);
  };

  const renderProviderCard = ({ item }: { item: Provider }) => {
    const hasSoonerCare = item.insuranceAccepted.includes('SoonerCare') || 
                          item.insuranceAccepted.includes('Medicaid');
    const acceptingPatients = item.acceptsNewPatients ?? item.acceptingNewPatients ?? true;
    const isVerified = item.verified ?? false;
    
    return (
      <TouchableOpacity
        style={[styles.providerCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => handleProviderPress(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
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
                <Text style={[styles.soonerCareText, { color: colors.success }]}>💊 SoonerCare</Text>
              </View>
            )}
            
            <View style={styles.ratingRow}>
              <Text style={styles.star}>⭐</Text>
              <Text style={[styles.rating, { color: colors.text }]}>{item.rating.toFixed(1)}</Text>
            </View>
          </View>
          
          <Text style={[styles.chevron, { color: colors.subtext }]}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading providers...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          {userName ? `Hi ${userName}` : 'Find Care'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>
          {providers.length}+ verified Oklahoma providers
        </Text>
      </View>

      <View style={[styles.insuranceBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.insuranceContent}>
          <Text style={styles.insuranceIcon}>💊</Text>
          <View style={styles.insuranceTextContainer}>
            <Text style={[styles.insuranceTitle, { color: colors.text }]}>
              Have SoonerCare or Medicaid?
            </Text>
            <Text style={[styles.insuranceSubtitle, { color: colors.subtext }]}>
              {showInsuranceFilter 
                ? 'Showing only providers who accept your coverage'
                : 'Tap to filter providers by your coverage'
              }
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.filterButton, 
            { backgroundColor: showInsuranceFilter ? colors.success : colors.primary }
          ]}
          onPress={() => setShowInsuranceFilter(!showInsuranceFilter)}
        >
          <Text style={styles.filterButtonText}>
            {showInsuranceFilter ? '✓ Active' : 'Filter'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search providers, specialties..."
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

      <DataDisclaimer />

      {!searchQuery && (
        <View style={styles.quickSearches}>
          <Text style={[styles.quickSearchTitle, { color: colors.subtext }]}>
            Common searches:
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickSearchScroll}>
            <TouchableOpacity
              style={[styles.quickSearchChip, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleQuickSearch('internal medicine')}
            >
              <Text style={[styles.quickSearchText, { color: colors.text }]}>
                🩺 Internal Medicine
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickSearchChip, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleQuickSearch('oklahoma city')}
            >
              <Text style={[styles.quickSearchText, { color: colors.text }]}>
                📍 Oklahoma City
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickSearchChip, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleQuickSearch('family')}
            >
              <Text style={[styles.quickSearchText, { color: colors.text }]}>
                👨‍👩‍👧 Family Medicine
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickSearchChip, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleQuickSearch('pediatric')}
            >
              <Text style={[styles.quickSearchText, { color: colors.text }]}>
                👶 Pediatrics
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          {availableCategories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.filterChip,
                { 
                  backgroundColor: selectedCategory === category ? colors.primary : colors.card,
                  borderColor: colors.border 
                }
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[
                styles.filterChipText,
                { color: selectedCategory === category ? '#fff' : colors.text }
              ]}>
                {category === 'all' ? 'All Specialties' : category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredProviders}
        renderItem={renderProviderCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No Providers Found
            </Text>
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              {searchQuery 
                ? `No providers found for "${searchQuery}"`
                : 'Try adjusting your search or filters'
              }
            </Text>
            
            {searchQuery && (
              <View style={[styles.suggestionBox, { backgroundColor: colors.card }]}>
                <Text style={[styles.suggestionTitle, { color: colors.text }]}>
                  💡 Try searching for:
                </Text>
                <Text style={[styles.suggestionItem, { color: colors.subtext }]}>
                  • Internal Medicine
                </Text>
                <Text style={[styles.suggestionItem, { color: colors.subtext }]}>
                  • Oklahoma City
                </Text>
                <Text style={[styles.suggestionItem, { color: colors.subtext }]}>
                  • Family Medicine
                </Text>
              </View>
            )}
            
            <TouchableOpacity
              style={[styles.clearButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setShowInsuranceFilter(false);
              }}
            >
              <Text style={styles.clearButtonText}>Clear All Filters</Text>
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
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  insuranceBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    padding: 16,
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
    fontSize: 32,
    marginRight: 12,
  },
  insuranceTextContainer: {
    flex: 1,
  },
  insuranceTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  insuranceSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginLeft: 12,
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  clearIcon: {
    fontSize: 20,
    color: '#999',
    padding: 4,
  },
  quickSearches: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  quickSearchTitle: {
    fontSize: 13,
    marginBottom: 8,
  },
  quickSearchScroll: {
    flexDirection: 'row',
  },
  quickSearchChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  quickSearchText: {
    fontSize: 14,
  },
  filtersContainer: {
    marginBottom: 12,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingTop: 0,
  },
  providerCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLeft: {
    marginRight: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  cardContent: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  providerName: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  verifiedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  specialty: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  availableBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
  },
  availableText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  soonerCareBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  soonerCareText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  star: {
    fontSize: 16,
  },
  rating: {
    fontSize: 16,
    fontWeight: '600',
  },
  chevron: {
    fontSize: 28,
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
  suggestionBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    width: '100%',
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  suggestionItem: {
    fontSize: 14,
    marginBottom: 6,
    paddingLeft: 8,
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