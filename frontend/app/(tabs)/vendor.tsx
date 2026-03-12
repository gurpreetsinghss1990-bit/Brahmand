import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  FlatList,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';
import { VendorRegistrationModal } from '../../src/components/VendorRegistrationModal';
import { useAuthStore } from '../../src/store/authStore';

const TABS = ['Nearby', 'Pooja', 'Grocery', 'Restaurant', 'Festival'];

interface Vendor {
  id: string;
  business_name: string;
  owner_name: string;
  category: string;
  address?: string;
  contact_number: string;
  delivery_available: boolean;
  distance?: number;
  rating?: number;
}

// Mock vendors - in real app this would come from API
const INITIAL_VENDORS: Vendor[] = [
  { id: '1', business_name: 'Sharma Pooja Samagri', owner_name: 'Ramesh Sharma', category: 'Pooja', address: 'Borivali West', contact_number: '9876543210', delivery_available: true, distance: 0.5, rating: 4.5 },
  { id: '2', business_name: 'Krishna Grocery Store', owner_name: 'Krishna Patel', category: 'Grocery', address: 'Kandivali East', contact_number: '9876543211', delivery_available: true, distance: 1.2, rating: 4.2 },
  { id: '3', business_name: 'Annapurna Restaurant', owner_name: 'Suresh Gupta', category: 'Restaurant', address: 'Malad West', contact_number: '9876543212', delivery_available: false, distance: 2.0, rating: 4.8 },
];

export default function VendorScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('Nearby');
  const [vendors, setVendors] = useState<Vendor[]>(INITIAL_VENDORS);
  const [refreshing, setRefreshing] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);

  const getFilteredVendors = () => {
    if (activeTab === 'Nearby') {
      return [...vendors].sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }
    return vendors.filter(v => v.category === activeTab);
  };

  const handleRegisterVendor = async (data: any) => {
    // Create new vendor with random ID
    const newVendor: Vendor = {
      id: Date.now().toString(),
      business_name: data.business_name,
      owner_name: data.owner_name,
      category: data.category,
      address: data.address,
      contact_number: data.contact_number,
      delivery_available: data.delivery_available,
      distance: 0.1, // Assume very close since it's user's own vendor
      rating: 5.0, // New vendors start with 5 star
    };

    // Add to vendors list immediately
    setVendors(prev => [newVendor, ...prev]);
    Alert.alert('Success', 'Vendor registered successfully!');
  };

  const getVendorIcon = (category: string) => {
    switch (category) {
      case 'Pooja': return 'flower';
      case 'Grocery': return 'basket';
      case 'Restaurant': return 'restaurant';
      case 'Festival': return 'sparkles';
      default: return 'storefront';
    }
  };

  const getVendorColor = (category: string) => {
    switch (category) {
      case 'Pooja': return '#9C27B0';
      case 'Grocery': return COLORS.success;
      case 'Restaurant': return COLORS.warning;
      case 'Festival': return '#E91E63';
      default: return COLORS.primary;
    }
  };

  const renderVendor = ({ item }: { item: Vendor }) => (
    <TouchableOpacity style={styles.vendorCard}>
      <View style={[styles.vendorIcon, { backgroundColor: `${getVendorColor(item.category)}15` }]}>
        <Ionicons 
          name={getVendorIcon(item.category)} 
          size={24} 
          color={getVendorColor(item.category)} 
        />
      </View>
      <View style={styles.vendorInfo}>
        <Text style={styles.vendorName}>{item.business_name}</Text>
        <Text style={styles.vendorOwner}>{item.owner_name}</Text>
        <View style={styles.vendorMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="location" size={12} color={COLORS.textLight} />
            <Text style={styles.metaText}>{item.distance?.toFixed(1)} km</Text>
          </View>
          {item.rating && (
            <View style={styles.metaItem}>
              <Ionicons name="star" size={12} color={COLORS.warning} />
              <Text style={styles.metaText}>{item.rating}</Text>
            </View>
          )}
          {item.delivery_available && (
            <View style={[styles.deliveryBadge]}>
              <Ionicons name="bicycle" size={10} color={COLORS.success} />
              <Text style={styles.deliveryText}>Delivery</Text>
            </View>
          )}
        </View>
      </View>
      <TouchableOpacity style={styles.callButton}>
        <Ionicons name="call" size={18} color={COLORS.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Top Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
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
        </View>
      </View>

      {/* Register Vendor Button */}
      <TouchableOpacity 
        style={styles.registerButton}
        onPress={() => setShowRegistrationModal(true)}
      >
        <Ionicons name="add-circle" size={20} color={COLORS.primary} />
        <Text style={styles.registerText}>Register Vendor</Text>
      </TouchableOpacity>

      {/* Vendor List */}
      <FlatList
        data={getFilteredVendors()}
        renderItem={renderVendor}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 1000);
            }} 
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="storefront-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No vendors found</Text>
            <Text style={styles.emptySubtext}>Be the first to register in this category!</Text>
          </View>
        }
      />

      {/* Vendor Registration Modal */}
      <VendorRegistrationModal
        visible={showRegistrationModal}
        onClose={() => setShowRegistrationModal(false)}
        onSubmit={handleRegisterVendor}
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
  tabsScroll: {
    flex: 1,
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
    paddingBottom: 100,
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
    width: 52,
    height: 52,
    borderRadius: 14,
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
  vendorOwner: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  vendorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    flexWrap: 'wrap',
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginLeft: 3,
  },
  deliveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.success}15`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  deliveryText: {
    fontSize: 10,
    color: COLORS.success,
    fontWeight: '500',
    marginLeft: 3,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
});
