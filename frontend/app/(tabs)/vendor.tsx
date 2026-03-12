import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  FlatList 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../src/constants/theme';

const TABS = ['Nearby', 'Pooja', 'Grocery', 'Restaurant', 'Festival'];

// Mock vendor data
const MOCK_VENDORS = [
  { id: '1', name: 'Sharma Pooja Samagri', category: 'Pooja', area: 'Borivali', rating: 4.5 },
  { id: '2', name: 'Krishna Grocery Store', category: 'Grocery', area: 'Kandivali', rating: 4.2 },
  { id: '3', name: 'Annapurna Restaurant', category: 'Restaurant', area: 'Malad', rating: 4.8 },
];

export default function VendorScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Nearby');
  const [vendors, setVendors] = useState(MOCK_VENDORS);
  const [refreshing, setRefreshing] = useState(false);

  const renderVendor = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.vendorCard}>
      <View style={styles.vendorIcon}>
        <Ionicons 
          name={item.category === 'Pooja' ? 'flower' : item.category === 'Grocery' ? 'basket' : 'restaurant'} 
          size={24} 
          color={COLORS.primary} 
        />
      </View>
      <View style={styles.vendorInfo}>
        <Text style={styles.vendorName}>{item.name}</Text>
        <Text style={styles.vendorCategory}>{item.category}</Text>
        <View style={styles.vendorMeta}>
          <Ionicons name="location" size={12} color={COLORS.textLight} />
          <Text style={styles.vendorArea}>{item.area}</Text>
          <Ionicons name="star" size={12} color={COLORS.warning} style={{ marginLeft: 8 }} />
          <Text style={styles.vendorRating}>{item.rating}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Top Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="search" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="filter" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Register Vendor Button */}
      <TouchableOpacity style={styles.registerButton}>
        <Ionicons name="add-circle" size={20} color={COLORS.primary} />
        <Text style={styles.registerText}>Register Vendor</Text>
      </TouchableOpacity>

      {/* Vendor List */}
      <FlatList
        data={vendors}
        renderItem={renderVendor}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(false)} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="storefront-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No vendors found nearby</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingVertical: SPACING.sm,
  },
  tab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginLeft: SPACING.sm,
    borderRadius: 20,
  },
  tabActive: {
    backgroundColor: `${COLORS.primary}15`,
  },
  tabText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    paddingRight: SPACING.md,
  },
  headerIcon: {
    padding: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${COLORS.primary}10`,
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  registerText: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '600',
    marginLeft: SPACING.sm,
  },
  listContent: {
    paddingHorizontal: SPACING.md,
  },
  vendorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 16,
    marginBottom: 12,
  },
  vendorIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  vendorInfo: {
    flex: 1,
  },
  vendorName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  vendorCategory: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  vendorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  vendorArea: {
    fontSize: 12,
    color: COLORS.textLight,
    marginLeft: 4,
  },
  vendorRating: {
    fontSize: 12,
    color: COLORS.textLight,
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
});
