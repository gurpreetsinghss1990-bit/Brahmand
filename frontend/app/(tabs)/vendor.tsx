import React, { useState, useEffect, useCallback } from 'react';
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
  Alert,
  ActivityIndicator,
  Image,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';
import formatDistance from '../../src/utils/formatDistance';
import { VendorRegistrationModal } from '../../src/components/VendorRegistrationModal';
import { useAuthStore } from '../../src/store/authStore';
import { useVendorStore, Vendor, DEFAULT_CATEGORIES } from '../../src/store/vendorStore';
import { ensureForegroundPermission, getCurrentPosition } from '../../src/services/location';
import * as Location from 'expo-location';

const TABS = ['Nearby', 'Pooja', 'Grocery', 'Restaurant', 'Festival'];

export default function VendorScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated } = useAuthStore();
  const userId = user?.id;
  const { 
    vendors, 
    myVendor, 
    categories,
    loading,
    fetchVendors, 
    fetchMyVendor,
    fetchCategories,
    createVendor 
  } = useVendorStore();
  
  const [activeTab, setActiveTab] = useState('Nearby');
  const [refreshing, setRefreshing] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);
  const [searchCategory, setSearchCategory] = useState<string>('All');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const homeLocation = (user as any)?.home_location;
  const homeLatitude = homeLocation?.latitude;
  const homeLongitude = homeLocation?.longitude;
  const hasHomeCoordinates = typeof homeLatitude === 'number' && typeof homeLongitude === 'number';

  const loadData = useCallback(async () => {
    // Get user location
    try {
      if (Platform.OS === 'web') {
        const hasPermission = await ensureForegroundPermission();
        if (hasPermission) {
          const location = await getCurrentPosition();
          setUserLocation({
            lat: location.coords.latitude,
            lng: location.coords.longitude
          });
          await fetchVendors({
            lat: location.coords.latitude,
            lng: location.coords.longitude
          });
        } else if (hasHomeCoordinates) {
          setUserLocation({
            lat: homeLatitude!,
            lng: homeLongitude!,
          });
          await fetchVendors({
            lat: homeLatitude!,
            lng: homeLongitude!,
          });
        } else {
          await fetchVendors();
        }
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          setUserLocation({
            lat: location.coords.latitude,
            lng: location.coords.longitude
          });
          await fetchVendors({
            lat: location.coords.latitude,
            lng: location.coords.longitude
          });
        } else {
          await fetchVendors();
        }
      }
    } catch (error) {
      if (Platform.OS === 'web' && hasHomeCoordinates) {
        setUserLocation({
          lat: homeLatitude!,
          lng: homeLongitude!,
        });
        await fetchVendors({
          lat: homeLatitude!,
          lng: homeLongitude!,
        });
      } else {
        await fetchVendors();
      }
    }
    
    await fetchMyVendor();
    await fetchCategories();
  }, [fetchVendors, fetchMyVendor, fetchCategories, hasHomeCoordinates, homeLatitude, homeLongitude]);

  useEffect(() => {
    // Redirect to auth if not authenticated after auth is loaded
    if (!authLoading && !isAuthenticated) {
      router.replace('/auth' as any);
      return;
    }
    
    if (!userId) {
      return;
    }
    loadData();
  }, [loadData, userId, authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = categories.filter(cat => 
        cat.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCategories(filtered);
    } else {
      setFilteredCategories([]);
    }
  }, [searchTerm, categories]);

  const displayVendors = React.useMemo(() => {
    let filtered = vendors || [];
    const effectiveCategory = searchCategory !== 'All' ? searchCategory : activeTab;

    if (effectiveCategory && effectiveCategory !== 'Nearby') {
      const lowerCategory = effectiveCategory.toLowerCase();
      filtered = filtered.filter((v) => {
        const categories = v.categories || [];
        return categories.some((c) => (c || '').toLowerCase().includes(lowerCategory));
      });
    }

    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((v) => {
        const name = (v.business_name || '').toLowerCase();
        return name.includes(term);
      });
    }

    return filtered.sort((a, b) => (a.distance || 9999) - (b.distance || 9999));
  }, [vendors, activeTab, searchTerm, searchCategory]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleRegisterVendor = async (data: any) => {
    try {
      await createVendor({
        businessName: data.businessName,
        ownerName: data.ownerName,
        yearsInBusiness: data.yearsInBusiness || 0,
        categories: data.categories,
        address: data.address,
        locationLink: data.locationLink || undefined,
        phoneNumber: data.phoneNumber,
        latitude: data.latitude || undefined,
        longitude: data.longitude || undefined,
      });
      Alert.alert('Success', 'Your business has been registered!');
      setShowRegistrationModal(false);
      // Force refresh data so it shows immediately
      await fetchMyVendor();
      if (userLocation) {
        await fetchVendors(userLocation);
      } else {
        await fetchVendors();
      }
    } catch (error: any) {
      console.error('Vendor API Registration Error:', error.response?.data);
      let errorMsg = 'Failed to register business';
      if (error.response?.data?.detail) {
        if (Array.isArray(error.response.data.detail)) {
          errorMsg = error.response.data.detail.map((err: any) => `${err.loc?.[1] || err.loc?.[0]}: ${err.msg}`).join('\n');
        } else if (typeof error.response.data.detail === 'string') {
          errorMsg = error.response.data.detail;
        } else {
          errorMsg = JSON.stringify(error.response.data.detail);
        }
      }
      Alert.alert('Error', errorMsg);
    }
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const getVendorIcon = (vendorCategories?: string[]) => {
    const cats = vendorCategories || [];
    const category = cats[0]?.toLowerCase() || '';
    if (category.includes('pooja') || category.includes('pandit')) return 'flower';
    if (category.includes('grocery') || category.includes('sweets')) return 'basket';
    if (category.includes('restaurant') || category.includes('catering')) return 'restaurant';
    if (category.includes('gym') || category.includes('yoga')) return 'fitness';
    if (category.includes('salon')) return 'cut';
    return 'storefront';
  };

  const renderVendor = ({ item }: { item: Vendor }) => {
    const vendorCategories = item?.categories || [];
    
    return (
      <TouchableOpacity 
        style={styles.vendorCard}
        onPress={() => router.push(`/vendor/${item.id}`)}
      >
        {/* Business Image Placeholder */}
        <View style={styles.vendorImageContainer}>
          {(item.business_gallery_images && item.business_gallery_images.find((url) => !!url)) || (item.photos && item.photos.length > 0) ? (
            <Image
              source={{ uri: (item.business_gallery_images || []).find((url) => !!url) || item.photos[0] }}
              style={styles.vendorImage}
            />
          ) : (
            <View style={styles.vendorImagePlaceholder}>
              <Ionicons name={getVendorIcon(vendorCategories) as any} size={28} color={COLORS.primary} />
            </View>
          )}
        </View>

        <View style={styles.vendorInfo}>
          <Text style={styles.vendorName}>{item.business_name || 'Unnamed Business'}</Text>
          
          {/* Categories */}
          {vendorCategories.length > 0 && (
            <View style={styles.categoriesRow}>
              {vendorCategories.slice(0, 2).map((cat, idx) => (
                <View key={idx} style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{cat}</Text>
                </View>
              ))}
              {vendorCategories.length > 2 && (
                <Text style={styles.moreCats}>+{vendorCategories.length - 2}</Text>
              )}
            </View>
          )}
          
          {/* Distance */}
          <View style={styles.distanceRow}>
            <Ionicons name="location" size={12} color={COLORS.textLight} />
            <Text style={styles.distanceText}>{formatDistance(item.distance)}</Text>
          </View>
        </View>

        {/* Call Button */}
        <TouchableOpacity 
          style={styles.callButton}
          onPress={() => handleCall(item.phone_number)}
        >
          <Ionicons name="call" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

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
          <View style={styles.searchInputRow}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={18} color={COLORS.textLight} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by business name or category"
                placeholderTextColor={COLORS.textLight}
                value={searchTerm}
                onChangeText={setSearchTerm}
                returnKeyType="search"
                blurOnSubmit={false}
              />
              {searchTerm && (
                <TouchableOpacity onPress={() => setSearchTerm('')}>
                  <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.filterIconButton}
              onPress={() => setShowCategoryFilter((prev) => !prev)}
            >
              <Ionicons name="filter" size={22} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {searchCategory !== 'All' && (
            <View style={styles.activeFilterContainer}>
              <Text style={styles.activeFilterText}>Category: {searchCategory}</Text>
              <TouchableOpacity
                onPress={() => {
                  setSearchCategory('All');
                  setShowCategoryFilter(false);
                }}
              >
                <Ionicons name="close-circle" size={16} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>
          )}

          {showCategoryFilter && (
            <View style={styles.filterPanel}>
              <View style={styles.chipsContainer}>
                <TouchableOpacity
                  style={[styles.categoryChip, searchCategory === 'All' && styles.categoryChipActive]}
                  onPress={() => {
                    setSearchCategory('All');
                    setShowCategoryFilter(false);
                  }}
                >
                  <Text style={[styles.categoryChipText, searchCategory === 'All' && styles.categoryChipTextActive]}>All</Text>
                </TouchableOpacity>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, searchCategory === cat && styles.categoryChipActive]}
                    onPress={() => {
                      setSearchCategory(cat);
                      setShowCategoryFilter(false);
                    }}
                  >
                    <Text style={[styles.categoryChipText, searchCategory === cat && styles.categoryChipTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Category Suggestions */}
          {filteredCategories.length > 0 && !showCategoryFilter && (
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

          {/* Active Filter Badge */}
          {searchCategory !== 'All' && !showCategoryFilter && (
            <View style={styles.activeFilterContainer}>
              <Text style={styles.activeFilterText}>Filtered: {searchCategory}</Text>
              <TouchableOpacity
                onPress={() => {
                  setSearchCategory('All');
                }}
              >
                <Ionicons name="close-circle" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
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
            <Text style={styles.myBusinessName}>{myVendor.business_name}</Text>
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

      {/* Loading State */}
      {loading && vendors.length === 0 && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
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
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="storefront-outline" size={48} color={COLORS.textLight} />
              <Text style={styles.emptyText}>No vendors found</Text>
              <Text style={styles.emptySubtext}>Be the first to register in this area!</Text>
            </View>
          ) : null
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
  loadingContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
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
    borderWidth: 1,
    borderColor: COLORS.border,
    flex: 1,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  filterIconButton: {
    width: 40,
    height: 40,
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeFilterContainer: {
    marginTop: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeFilterText: {
    fontSize: 12,
    color: COLORS.primary,
    marginRight: SPACING.xs,
  },
  filterPanel: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.divider,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    maxHeight: 400,
  },
  filterModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  filterModal: {
    width: '90%',
    maxHeight: '65%',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  filterModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: SPACING.sm,
    color: COLORS.text,
  },
  filterOptionsList: {
    marginBottom: SPACING.sm,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  filterOption: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.background,
  },
  filterOptionActive: {
    backgroundColor: `${COLORS.primary}20`,
  },
  filterOptionText: {
    color: COLORS.text,
    fontSize: 14,
  },
  categoryChip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: COLORS.surface,
  },
  filterActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  filterActionButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
  },
  filterActionText: {
    color: COLORS.surface,
    fontWeight: '600',
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
  categoriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  categoryBadge: {
    backgroundColor: `${COLORS.primary}10`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 4,
    marginBottom: 2,
  },
  categoryBadgeText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '500',
  },
  moreCats: {
    fontSize: 11,
    color: COLORS.textLight,
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
