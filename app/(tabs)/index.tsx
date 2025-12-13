import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { mockProviders, Provider, ProviderCategory } from '../../data/providers';

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProviderCategory | 'All'>('All');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('All');

  const categories: Array<ProviderCategory | 'All'> = [
    'All',
    'Core Services',
    'Extended Services',
    'Rare & Specialized Services'
  ];

  // Get unique specialties based on selected category
  const availableSpecialties = selectedCategory === 'All' 
    ? ['All', ...Array.from(new Set(mockProviders.map(p => p.specialty)))]
    : ['All', ...Array.from(new Set(
        mockProviders
          .filter(p => p.category === selectedCategory)
          .map(p => p.specialty)
      ))];

  const filteredProviders = mockProviders.filter(provider => {
    const matchesSearch = provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         provider.specialty.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'All' || provider.category === selectedCategory;
    const matchesSpecialty = selectedSpecialty === 'All' || provider.specialty === selectedSpecialty;
    
    return matchesSearch && matchesCategory && matchesSpecialty;
  });

  const renderProvider = ({ item }: { item: Provider }) => (
    <TouchableOpacity 
      style={[styles.providerCard, { backgroundColor: colors.background, borderColor: colors.border }]}
      onPress={() => router.push(`/provider/${item.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={[styles.categoryBadge, { backgroundColor: colors.card, borderColor: colors.primary }]}>
        <Text style={[styles.categoryText, { color: colors.primary }]}>{item.category}</Text>
      </View>
      
      <View style={styles.providerHeader}>
        <View style={[styles.providerAvatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.providerAvatarText}>
            {item.name.split(' ').map(n => n[0]).join('')}
          </Text>
        </View>
        <View style={styles.providerInfo}>
          <Text style={[styles.providerName, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.providerSpecialty, { color: colors.primary }]}>{item.specialty}</Text>
        </View>
        <View style={[
          styles.availableBadge, 
          !item.available && styles.unavailableBadge
        ]}>
          <Text style={styles.badgeText}>
            {item.available ? 'Available' : 'Unavailable'}
          </Text>
        </View>
      </View>
      
      <View style={styles.providerDetails}>
        <View style={styles.detailItem}>
          <Text style={styles.detailIcon}>📍</Text>
          <Text style={[styles.detailText, { color: colors.subtext }]}>{item.distance} miles</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailIcon}>⭐</Text>
          <Text style={[styles.detailText, { color: colors.subtext }]}>{item.rating}</Text>
        </View>
      </View>
      
      <View style={[styles.viewDetailsButton, { backgroundColor: colors.card }]}>
        <Text style={[styles.viewDetailsText, { color: colors.primary }]}>View Details →</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <Text style={[styles.title, { color: colors.primary }]}>🤰 Find Your Provider</Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>Comprehensive maternal healthcare network</Text>
      </View>
      
      <TextInput
        style={[styles.searchBar, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
        placeholder="Search by name or specialty..."
        placeholderTextColor={colors.subtext}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      
      <View style={styles.filterSection}>
        <Text style={[styles.filterLabel, { color: colors.text }]}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {categories.map(category => (
            <TouchableOpacity
              key={category}
              style={[
                styles.filterChip,
                { borderColor: colors.primary, backgroundColor: colors.background },
                selectedCategory === category && { backgroundColor: colors.primary }
              ]}
              onPress={() => {
                setSelectedCategory(category);
                setSelectedSpecialty('All');
              }}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filterText,
                { color: selectedCategory === category ? '#fff' : colors.primary }
              ]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.filterSection}>
        <Text style={[styles.filterLabel, { color: colors.text }]}>Specialty</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {availableSpecialties.map(specialty => (
            <TouchableOpacity
              key={specialty}
              style={[
                styles.filterChip,
                { borderColor: colors.primary, backgroundColor: colors.background },
                selectedSpecialty === specialty && { backgroundColor: colors.primary }
              ]}
              onPress={() => setSelectedSpecialty(specialty)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filterText,
                { color: selectedSpecialty === specialty ? '#fff' : colors.primary }
              ]}>
                {specialty}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      <View style={styles.resultsHeader}>
        <Text style={[styles.resultsText, { color: colors.subtext }]}>
          {filteredProviders.length} provider{filteredProviders.length !== 1 ? 's' : ''} found
        </Text>
        {(searchQuery || selectedCategory !== 'All' || selectedSpecialty !== 'All') && (
          <TouchableOpacity onPress={() => {
            setSearchQuery('');
            setSelectedCategory('All');
            setSelectedSpecialty('All');
          }}>
            <Text style={[styles.clearText, { color: colors.primary }]}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <FlatList
        data={filteredProviders}
        renderItem={renderProvider}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No providers found</Text>
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              Try adjusting your search or filters
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
  },
  searchBar: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 15,
    padding: 15,
    borderWidth: 2,
    borderRadius: 12,
    fontSize: 16,
  },
  filterSection: {
    marginBottom: 15,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  filterScroll: {
    paddingHorizontal: 20,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    marginRight: 10,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  resultsText: {
    fontSize: 14,
    fontWeight: '500',
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  providerCard: {
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  providerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  providerAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  providerSpecialty: {
    fontSize: 14,
    fontWeight: '600',
  },
  availableBadge: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  unavailableBadge: {
    backgroundColor: '#999',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  providerDetails: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 10,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIcon: {
    fontSize: 14,
    marginRight: 5,
  },
  detailText: {
    fontSize: 14,
    fontWeight: '500',
  },
  viewDetailsButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewDetailsText: {
    fontWeight: '600',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 15,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});