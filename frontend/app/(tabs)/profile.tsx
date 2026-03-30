import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { getUserProfile, getCulturalCommunities, getUserCulturalCommunity, updateUserCulturalCommunity } from '../../src/services/api';
import { Avatar } from '../../src/components/Avatar';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

const MENU_ITEMS = [
  { id: 'edit', icon: 'person-circle', label: 'Edit Profile', route: '/profile/edit' },
  { id: 'cultural', icon: 'people', label: 'Cultural Community', action: 'cultural' },
  { id: 'location', icon: 'location', label: 'Change Location', route: '/settings/location' },
  { id: 'privacy', icon: 'shield-checkmark', label: 'Privacy', route: '/settings/privacy' },
  { id: 'notifications', icon: 'notifications', label: 'Notifications', route: '/settings/notifications' },
  { id: 'kyc', icon: 'document-text', label: 'KYC Verification', route: '/kyc' },
  { id: 'badges', icon: 'ribbon', label: 'Community Badges', route: '/badges' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, updateUser } = useAuthStore();
  const userId = user?.id;
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  
  // Cultural Community state
  const [showCGModal, setShowCGModal] = useState(false);
  const [cgSearch, setCGSearch] = useState('');
  const [cgList, setCGList] = useState<string[]>([]);
  const [cgLoading, setCGLoading] = useState(false);
  const [userCG, setUserCG] = useState<{ cultural_community: string | null; change_count: number; is_locked: boolean } | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await getUserProfile();
      setProfile(res.data);
      updateUser(res.data || {});
      
      // Fetch cultural community info
      const cgRes = await getUserCulturalCommunity();
      setUserCG(cgRes.data);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      if (error?.response?.status === 401 || error?.response?.status === 502) {
        // token may be invalid/expired, force logout and go to login
        await logout();
        router.replace('/auth/phone');
      }
    } finally {
      setRefreshing(false);
    }
  }, [logout, router, updateUser]);

  useEffect(() => {
    if (!userId) {
      router.replace('/auth/phone');
      return;
    }
    fetchProfile();
  }, [fetchProfile, router, userId]);

  const loadCulturalCommunities = async (search?: string) => {
    setCGLoading(true);
    try {
      const res = await getCulturalCommunities(search);
      setCGList(res.data || []);
    } catch (error) {
      console.error('Error loading communities:', error);
    } finally {
      setCGLoading(false);
    }
  };

  const handleOpenCGModal = () => {
    loadCulturalCommunities();
    setShowCGModal(true);
  };

  const handleSelectCG = async (community: string) => {
    if (userCG?.is_locked) {
      Alert.alert('Locked', 'You have already changed your cultural community 2 times. It is now locked.');
      return;
    }
    
    const changeMessage = userCG?.cultural_community 
      ? `Change from "${userCG.cultural_community}" to "${community}"? You have ${2 - (userCG?.change_count || 0)} changes remaining.`
      : `Set your cultural community to "${community}"?`;
    
    Alert.alert('Confirm', changeMessage, [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Confirm', 
        onPress: async () => {
          try {
            await updateUserCulturalCommunity(community);
            await fetchProfile();
            setShowCGModal(false);
            Alert.alert('Success', 'Cultural community updated!');
          } catch (error: any) {
            Alert.alert('Error', error.response?.data?.detail || 'Failed to update');
          }
        }
      }
    ]);
  };

  const handleMenuPress = (item: any) => {
    if (item.action === 'cultural') {
      handleOpenCGModal();
    } else if (item.route) {
      router.push(item.route as any);
    }
  };

  const performLogout = async () => {
    await logout();
    router.replace('/');
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      performLogout();
      return;
    }

    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => {
          performLogout();
        } },
      ]
    );
  };

  const displayUser = profile || user;

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProfile(); }} />
      }
    >
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {displayUser?.photo ? (
            <Image source={{ uri: displayUser.photo }} style={styles.avatar} />
          ) : (
            <Avatar name={displayUser?.name || 'User'} size={100} />
          )}
          {displayUser?.is_verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
            </View>
          )}
        </View>
        <Text style={styles.userName}>{displayUser?.name || 'User'}</Text>
        <Text style={styles.userId}>{displayUser?.sl_id || ''}</Text>
        
        {/* Location Info */}
        {displayUser?.home_location && (
          <View style={styles.locationRow}>
            <Ionicons name="location" size={14} color={COLORS.textSecondary} />
            <Text style={styles.locationText}>
              {displayUser.home_location.area}, {displayUser.home_location.city}
            </Text>
          </View>
        )}
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{displayUser?.communities?.length || 0}</Text>
          <Text style={styles.statLabel}>Communities</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{displayUser?.badges?.length || 0}</Text>
          <Text style={styles.statLabel}>Badges</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{displayUser?.reputation || 0}</Text>
          <Text style={styles.statLabel}>Reputation</Text>
        </View>
      </View>

      {/* Horoscope Profile removed per request */}

      {/* Menu Items */}
      <View style={styles.menuSection}>
        {MENU_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.menuItem}
            onPress={() => handleMenuPress(item)}
          >
            <View style={styles.menuIconContainer}>
              <Ionicons name={item.icon as any} size={22} color={COLORS.primary} />
            </View>
            <View style={styles.menuLabelContainer}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              {item.id === 'cultural' && userCG?.cultural_community && (
                <Text style={styles.menuSubLabel}>{userCG.cultural_community}</Text>
              )}
              {/* Horoscope menu item removed */}
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Guidelines Link */}
      <TouchableOpacity 
        style={styles.guidelinesLink}
        onPress={() => router.push('/settings/guidelines')}
      >
        <Ionicons name="document-text" size={18} color={COLORS.info} />
        <Text style={styles.guidelinesText}>Community Guidelines</Text>
      </TouchableOpacity>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out" size={20} color={COLORS.error} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 100 }} />

      {/* Cultural Community Modal */}
      <Modal
        visible={showCGModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCGModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Cultural Community</Text>
              <TouchableOpacity onPress={() => setShowCGModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {userCG?.is_locked && (
              <View style={styles.lockedBanner}>
                <Ionicons name="lock-closed" size={16} color={COLORS.error} />
                <Text style={styles.lockedText}>Locked - Maximum changes reached</Text>
              </View>
            )}

            {userCG?.cultural_community && !userCG?.is_locked && (
              <View style={styles.currentCGBanner}>
                <Text style={styles.currentCGText}>
                  Current: {userCG.cultural_community} ({2 - (userCG.change_count || 0)} changes left)
                </Text>
              </View>
            )}

            <TextInput
              style={styles.searchInput}
              placeholder="Search communities..."
              placeholderTextColor={COLORS.textLight}
              value={cgSearch}
              onChangeText={(text) => {
                setCGSearch(text);
                loadCulturalCommunities(text);
              }}
            />

            {cgLoading ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
            ) : (
              <FlatList
                data={cgList}
                keyExtractor={(item, index) => `${item}-${index}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.cgItem,
                      userCG?.cultural_community === item && styles.cgItemSelected
                    ]}
                    onPress={() => handleSelectCG(item)}
                    disabled={userCG?.is_locked}
                  >
                    <Text style={[
                      styles.cgItemText,
                      userCG?.cultural_community === item && styles.cgItemTextSelected
                    ]}>
                      {item}
                    </Text>
                    {userCG?.cultural_community === item && (
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                )}
                style={styles.cgList}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No communities found</Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  userId: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: 16,
    padding: SPACING.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 8,
  },
  astrologyCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.surface,
  },
  astrologyCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  astrologyIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EAF3FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  astrologyCardContent: {
    flex: 1,
  },
  astrologyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  astrologySubtitle: {
    marginTop: 4,
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  astrologyBadge: {
    alignSelf: 'flex-start',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
  },
  astrologyBadgeReady: {
    backgroundColor: `${COLORS.success}15`,
  },
  astrologyBadgePending: {
    backgroundColor: `${COLORS.warning}18`,
  },
  astrologyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  astrologyBadgeTextReady: {
    color: COLORS.success,
  },
  astrologyBadgeTextPending: {
    color: COLORS.warning,
  },
  menuSection: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: `${COLORS.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
  },
  menuLabelContainer: {
    flex: 1,
  },
  menuSubLabel: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
  },
  guidelinesLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  guidelinesText: {
    fontSize: 14,
    color: COLORS.info,
    marginLeft: SPACING.xs,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  logoutText: {
    fontSize: 16,
    color: COLORS.error,
    fontWeight: '600',
    marginLeft: SPACING.sm,
  },
  // Cultural Community Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.error}15`,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  lockedText: {
    fontSize: 13,
    color: COLORS.error,
    marginLeft: SPACING.xs,
  },
  currentCGBanner: {
    backgroundColor: `${COLORS.primary}15`,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  currentCGText: {
    fontSize: 13,
    color: COLORS.primary,
    textAlign: 'center',
  },
  searchInput: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  cgList: {
    maxHeight: 400,
  },
  cgItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  cgItemSelected: {
    backgroundColor: `${COLORS.primary}10`,
  },
  cgItemText: {
    fontSize: 15,
    color: COLORS.text,
  },
  cgItemTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginTop: SPACING.xl,
  },
});
