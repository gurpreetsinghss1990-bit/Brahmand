import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  FlatList,
  TextInput,
  Linking,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';
import { VendorRegistrationModal } from '../../src/components/VendorRegistrationModal';
import { useAuthStore } from '../../src/store/authStore';
import { useVendorStore, Vendor, VENDOR_CATEGORIES } from '../../src/store/vendorStore';

const TABS = ['Nearby', 'Pooja', 'Grocery', 'Restaurant', 'Festival'];

const TRUST_LABELS = {
  trusted: { label: 'Trusted Vendor', color: COLORS.success, icon: 'shield-checkmark' },
  frequent: { label: 'Frequently Used', color: COLORS.info, icon: 'trending-up' },
  verified_local: { label: 'Verified Local', color: COLORS.primary, icon: 'location' },
};

export default function VendorScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { vendors, myVendor, addVendor, setMyVendor, getFilteredVendors, loadFromStorage } = useVendorStore();
  
  const [activeTab, setActiveTab] = useState('Nearby');
  const [refreshing, setRefreshing] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);

  useEffect(() => {
    loadFromStorage();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = VENDOR_CATEGORIES.filter(cat => 
        cat.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCategories(filtered);
    } else {
      setFilteredCategories([]);
    }
  }, [searchTerm]);

  const displayVendors = getFilteredVendors(
    activeTab === 'Nearby' ? undefined : activeTab,
    searchTerm,
    user?.id
  );

  const handleRegisterVendor = async (data: any) => {
    const newVendor: Vendor = {
      id: Date.now().toString(),
      businessName: data.businessName,
      ownerName: data.ownerName,
      phoneNumber: data.phoneNumber,
      yearsInBusiness: data.yearsInBusiness,
      categories: data.categories,
      address: data.address,
      locationLink: data.locationLink,
      latitude: data.latitude,
      longitude: data.longitude,
      distance: 0,
      trustLabel: 'verified_local',
      galleryPhotos: data.photos || [],
      ownerId: user?.id || '',
      createdAt: new Date().toISOString(),
    };

    addVendor(newVendor);
    setMyVendor(newVendor);
    Alert.alert('Success', 'Your business has been registered!');
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const getVendorIcon = (categories: string[]) => {
    const category = categories[0];
    if (category?.includes('Pooja') || category?.includes('Pandit')) return 'flower';
    if (category?.includes('Grocery') || category?.includes('Sweets')) return 'basket';
    if (category?.includes('Restaurant') || category?.includes('Catering')) return 'restaurant';
    if (category?.includes('Gym') || category?.includes('Yoga')) return 'fitness';
    if (category?.includes('Salon')) return 'cut';
    return 'storefront';
  };

  const renderVendor = ({ item }: { item: Vendor }) => {
    const trustInfo = TRUST_LABELS[item.trustLabel];
    
    return (
      <TouchableOpacity 
        style={styles.vendorCard}
        onPress={() => router.push(`/vendor/${item.id}`)}
      >
        {/* Business Image Placeholder */}
        <View style={styles.vendorImageContainer}>
          {item.coverPhoto ? (
            <View style={styles.vendorImage}>
              <Ionicons name="image" size={24} color={COLORS.textLight} />
            </View>
          ) : (
            <View style={styles.vendorImagePlaceholder}>
              <Ionicons name={getVendorIcon(item.categories) as any} size={28} color={COLORS.primary} />
            </View>
          )}
        </View>

        <View style={styles.vendorInfo}>
          <Text style={styles.vendorName}>{item.businessName}</Text>
          
          {/* Trust Label */}
          <View style={[styles.trustBadge, { backgroundColor: `${trustInfo.color}15` }]}>
            <Ionicons name={trustInfo.icon as any} size={12} color={trustInfo.color} />
            <Text style={[styles.trustText, { color: trustInfo.color }]}>{trustInfo.label}</Text>
          </View>
          
          {/* Distance */}
          <View style={styles.distanceRow}>
            <Ionicons name="location" size={12} color={COLORS.textLight} />
            <Text style={styles.distanceText}>{item.distance?.toFixed(1)} km away</Text>
          </View>
        </View>

        {/* Call Button */}
        <TouchableOpacity 
          style={styles.callButton}
          onPress={() => handleCall(item.phoneNumber)}
        >
          <Ionicons name="call" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

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
        <TouchableOpacity 
          style={styles.headerIcon}
          onPress={() => setShowSearch(!showSearch)}
        >
          <Ionicons name="search" size={22} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      {showSearch && (
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={18} color={COLORS.textLight} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by category (Yoga, Gym, Restaurant...)"
              placeholderTextColor={COLORS.textLight}
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
            {searchTerm && (
              <TouchableOpacity onPress={() => setSearchTerm('')}>
                <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Category Suggestions */}
          {filteredCategories.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsScroll}>
              {filteredCategories.slice(0, 5).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={styles.suggestionChip}
                  onPress={() => setSearchTerm(cat)}
                >
                  <Text style={styles.suggestionText}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* My Business Section (if vendor owner) */}
      {myVendor && (
        <TouchableOpacity 
          style={styles.myBusinessCard}
          onPress={() => router.push('/vendor/dashboard')}
        >
          <View style={styles.myBusinessIcon}>
            <Ionicons name="storefront" size={24} color={COLORS.primary} />
          </View>
          <View style={styles.myBusinessInfo}>
            <Text style={styles.myBusinessLabel}>Manage My Business</Text>
            <Text style={styles.myBusinessName}>{myVendor.businessName}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
        </TouchableOpacity>
      )}

      {/* Register Vendor Button */}
      {!myVendor && (
        <TouchableOpacity 
          style={styles.registerButton}
          onPress={() => setShowRegistrationModal(true)}
        >
          <Ionicons name="add-circle" size={20} color={COLORS.primary} />
          <Text style={styles.registerText}>Register Your Business</Text>
        </TouchableOpacity>
      )}

      {/* Vendor List */}
      <FlatList
        data={displayVendors}
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
            <Text style={styles.emptySubtext}>Be the first to register in this area!</Text>
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
  headerIcon: {
    padding: SPACING.sm,
    marginRight: SPACING.sm,
  },
  searchContainer: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: 15,
    color: COLORS.text,
  },
  suggestionsScroll: {
    marginTop: SPACING.sm,
  },
  suggestionChip: {
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 16,
    marginRight: SPACING.sm,
  },
  suggestionText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  myBusinessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}10`,
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  myBusinessIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  myBusinessInfo: {
    flex: 1,
  },
  myBusinessLabel: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  myBusinessName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 2,
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
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: 12,
  },
  vendorImageContainer: {
    marginRight: SPACING.md,
  },
  vendorImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorInfo: {
    flex: 1,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 4,
  },
  trustText: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginLeft: 4,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
