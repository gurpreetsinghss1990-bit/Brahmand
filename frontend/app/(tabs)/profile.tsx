import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { Avatar } from '../../src/components/Avatar';
import { Badge } from '../../src/components/Badge';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/');
          },
        },
      ]
    );
  };

  if (!user) return null;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Header */}
      <View style={styles.header}>
        <Avatar name={user.name} photo={user.photo} size={100} />
        <Text style={styles.name}>{user.name}</Text>
        <View style={styles.slIdContainer}>
          <Text style={styles.slIdLabel}>Sanatan Lok ID</Text>
          <Text style={styles.slId}>{user.sl_id}</Text>
        </View>
      </View>

      {/* Badges */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Badges</Text>
        <View style={styles.badgeContainer}>
          {user.badges.map((badge, index) => (
            <Badge key={index} name={badge} size="medium" />
          ))}
        </View>
      </View>

      {/* Reputation */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reputation</Text>
        <View style={styles.reputationCard}>
          <Ionicons name="star" size={24} color={COLORS.accent} />
          <Text style={styles.reputationScore}>{user.reputation}</Text>
          <Text style={styles.reputationLabel}>points</Text>
        </View>
      </View>

      {/* Location */}
      {user.location && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.infoCard}>
            <Ionicons name="location" size={20} color={COLORS.primary} />
            <Text style={styles.infoText}>
              {user.location.area}, {user.location.city}, {user.location.state}
            </Text>
          </View>
        </View>
      )}

      {/* Language */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Language</Text>
        <View style={styles.infoCard}>
          <Ionicons name="language" size={20} color={COLORS.primary} />
          <Text style={styles.infoText}>{user.language}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{user.communities?.length || 0}</Text>
          <Text style={styles.statLabel}>Communities</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{user.circles?.length || 0}</Text>
          <Text style={styles.statLabel}>Circles</Text>
        </View>
      </View>

      {/* Share ID Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Share Your ID</Text>
        <View style={styles.shareCard}>
          <Text style={styles.shareText}>
            Share your Sanatan Lok ID with others to connect directly
          </Text>
          <View style={styles.shareIdBox}>
            <Text style={styles.shareIdText}>{user.sl_id}</Text>
            <TouchableOpacity style={styles.copyButton}>
              <Ionicons name="copy" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out" size={20} color={COLORS.error} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={styles.bottomPadding} />
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
    padding: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: BORDER_RADIUS.xl,
    borderBottomRightRadius: BORDER_RADIUS.xl,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  slIdContainer: {
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  slIdLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  slId: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 2,
  },
  section: {
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  reputationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  reputationScore: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  reputationLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.text,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
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
  },
  shareCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  shareText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  shareIdBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}10`,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
  },
  shareIdText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'center',
  },
  copyButton: {
    padding: SPACING.xs,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: `${COLORS.error}10`,
    borderRadius: BORDER_RADIUS.md,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.error,
    marginLeft: SPACING.sm,
  },
  bottomPadding: {
    height: SPACING.xl * 2,
  },
});
