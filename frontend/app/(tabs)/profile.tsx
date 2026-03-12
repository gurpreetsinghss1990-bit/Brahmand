import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image,
  RefreshControl,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { getUserProfile } from '../../src/services/api';
import { Avatar } from '../../src/components/Avatar';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

const MENU_ITEMS = [
  { id: 'edit', icon: 'person-circle', label: 'Edit Profile', route: '/profile/edit' },
  { id: 'location', icon: 'location', label: 'Change Location', route: '/settings/location' },
  { id: 'settings', icon: 'settings', label: 'Settings', route: '/settings' },
  { id: 'privacy', icon: 'shield-checkmark', label: 'Privacy', route: '/settings/privacy' },
  { id: 'notifications', icon: 'notifications', label: 'Notifications', route: '/settings/notifications' },
  { id: 'kyc', icon: 'document-text', label: 'KYC Verification', route: '/kyc' },
  { id: 'badges', icon: 'ribbon', label: 'Community Badges', route: '/badges' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await getUserProfile();
      setProfile(res.data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: () => {
          logout();
          router.replace('/');
        }},
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

      {/* Menu Items */}
      <View style={styles.menuSection}>
        {MENU_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.menuItem}
            onPress={() => router.push(item.route as any)}
          >
            <View style={styles.menuIconContainer}>
              <Ionicons name={item.icon as any} size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
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
});
