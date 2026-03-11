import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { Avatar } from '../../src/components/Avatar';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { getProfileCompletion, updateExtendedProfile, getHoroscope, getVerificationStatus } from '../../src/services/api';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, updateUser } = useAuthStore();
  
  const [profileCompletion, setProfileCompletion] = useState<any>(null);
  const [horoscope, setHoroscope] = useState<any>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editField, setEditField] = useState<{ key: string; label: string; value: string } | null>(null);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const [completionRes, verificationRes] = await Promise.all([
        getProfileCompletion(),
        getVerificationStatus(),
      ]);
      setProfileCompletion(completionRes.data);
      setIsVerified(verificationRes.data.is_verified);

      // Fetch horoscope if eligible
      if (completionRes.data.horoscope_eligible) {
        try {
          const horoscopeRes = await getHoroscope();
          setHoroscope(horoscopeRes.data);
        } catch (e) {
          console.log('Horoscope not available');
        }
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
    }
  };

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

  const handleEditField = (key: string, label: string, currentValue: string = '') => {
    setEditField({ key, label, value: currentValue });
    setEditModalVisible(true);
  };

  const handleSaveField = async () => {
    if (!editField) return;

    try {
      const updateData = { [editField.key]: editField.value };
      await updateExtendedProfile(updateData);
      updateUser({ [editField.key]: editField.value } as any);
      setEditModalVisible(false);
      fetchProfileData();
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  if (!user) return null;

  const extendedFields = [
    { key: 'kuldevi', label: 'Kuldevi', icon: 'flower' },
    { key: 'kuldevi_temple_area', label: 'Kuldevi Temple Area', icon: 'location' },
    { key: 'gotra', label: 'Gotra', icon: 'git-branch' },
    { key: 'date_of_birth', label: 'Date of Birth', icon: 'calendar' },
    { key: 'place_of_birth', label: 'Place of Birth', icon: 'navigate' },
    { key: 'time_of_birth', label: 'Time of Birth', icon: 'time' },
  ];

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
        
        {/* Verification Badge */}
        <View style={[styles.memberTypeBadge, isVerified ? styles.verifiedBadge : styles.basicBadge]}>
          <Ionicons 
            name={isVerified ? 'shield-checkmark' : 'person'} 
            size={14} 
            color={isVerified ? COLORS.success : COLORS.warning} 
          />
          <Text style={[styles.memberTypeText, { color: isVerified ? COLORS.success : COLORS.warning }]}>
            {isVerified ? 'Verified Member' : 'Basic Member'}
          </Text>
        </View>
      </View>

      {/* Verification Banner (if not verified) */}
      {!isVerified && (
        <TouchableOpacity 
          style={styles.verificationBanner}
          onPress={() => router.push('/verification')}
        >
          <Ionicons name="shield-checkmark" size={24} color={COLORS.warning} />
          <View style={styles.verificationInfo}>
            <Text style={styles.verificationTitle}>Verify Your Account</Text>
            <Text style={styles.verificationText}>Get full access to community features</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.warning} />
        </TouchableOpacity>
      )}

      {/* Profile Completion */}
      {profileCompletion && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Completion</Text>
          <View style={styles.completionCard}>
            <View style={styles.completionHeader}>
              <Text style={styles.completionPercent}>{profileCompletion.completion_percentage}%</Text>
              <Text style={styles.completionText}>Complete</Text>
            </View>
            <View style={styles.completionBar}>
              <View style={[styles.completionFill, { width: `${profileCompletion.completion_percentage}%` }]} />
            </View>
          </View>
        </View>
      )}

      {/* Badges */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Badges</Text>
        <View style={styles.badgeContainer}>
          {user.badges?.map((badge, index) => (
            <Badge key={index} name={badge} size="medium" />
          ))}
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
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{user.reputation || 0}</Text>
          <Text style={styles.statLabel}>Reputation</Text>
        </View>
      </View>

      {/* Horoscope Section (if eligible) */}
      {horoscope && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Horoscope</Text>
          <View style={styles.horoscopeCard}>
            <View style={styles.horoscopeHeader}>
              <View style={styles.zodiacBadge}>
                <Ionicons name="star" size={16} color={COLORS.accent} />
                <Text style={styles.zodiacText}>{horoscope.zodiac_sign}</Text>
              </View>
              <View style={styles.luckyInfo}>
                <Text style={styles.luckyLabel}>Lucky: </Text>
                <Text style={styles.luckyValue}>{horoscope.lucky_color} | {horoscope.lucky_number}</Text>
              </View>
            </View>
            <Text style={styles.horoscopeText}>{horoscope.daily_horoscope}</Text>
            <Text style={styles.auspiciousTime}>Auspicious Time: {horoscope.auspicious_time}</Text>
          </View>
        </View>
      )}

      {/* Extended Profile Fields */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Spiritual Profile</Text>
        <Text style={styles.sectionSubtitle}>Complete for personalized horoscope</Text>
        
        {extendedFields.map((field) => (
          <TouchableOpacity
            key={field.key}
            style={styles.fieldRow}
            onPress={() => handleEditField(field.key, field.label, (user as any)[field.key] || '')}
          >
            <View style={styles.fieldIcon}>
              <Ionicons name={field.icon as any} size={18} color={COLORS.primary} />
            </View>
            <View style={styles.fieldInfo}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <Text style={styles.fieldValue}>
                {(user as any)[field.key] || 'Tap to add'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Location */}
      {user.location && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.locationCard}>
            <Ionicons name="location" size={20} color={COLORS.primary} />
            <Text style={styles.locationText}>
              {user.location.area}, {user.location.city}, {user.location.state}
            </Text>
          </View>
        </View>
      )}

      {/* Share ID */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Share Your ID</Text>
        <View style={styles.shareCard}>
          <Text style={styles.shareText}>Share your Sanatan Lok ID to connect</Text>
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

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit {editField?.label}</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              value={editField?.value || ''}
              onChangeText={(text) => setEditField(prev => prev ? { ...prev, value: text } : null)}
              placeholder={`Enter ${editField?.label}`}
              placeholderTextColor={COLORS.textLight}
            />
            <Button title="Save" onPress={handleSaveField} />
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
  memberTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.sm,
  },
  verifiedBadge: {
    backgroundColor: `${COLORS.success}15`,
  },
  basicBadge: {
    backgroundColor: `${COLORS.warning}15`,
  },
  memberTypeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  verificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.warning}15`,
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: `${COLORS.warning}30`,
  },
  verificationInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  verificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  verificationText: {
    fontSize: 12,
    color: COLORS.textSecondary,
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
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: -SPACING.xs,
    marginBottom: SPACING.sm,
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  completionCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: SPACING.sm,
  },
  completionPercent: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  completionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  completionBar: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
  },
  completionFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
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
    fontSize: 24,
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
  horoscopeCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  horoscopeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  zodiacBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.accent}20`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  zodiacText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: SPACING.xs,
  },
  luckyInfo: {
    flexDirection: 'row',
  },
  luckyLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  luckyValue: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text,
  },
  horoscopeText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  auspiciousTime: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '500',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  fieldIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  fieldInfo: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  fieldValue: {
    fontSize: 14,
    color: COLORS.text,
    marginTop: 2,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  locationText: {
    fontSize: 14,
    color: COLORS.text,
    marginLeft: SPACING.sm,
    flex: 1,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
});
