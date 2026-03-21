import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS, SPACING } from '../constants/theme';

interface BadgeProps {
  name: string;
  size?: 'small' | 'medium';
}

const BADGE_CONFIG: Record<string, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  'New Member': { color: COLORS.textSecondary, icon: 'person' },
  'Verified Member': { color: COLORS.badge.verified, icon: 'checkmark-circle' },
  'Trusted Community Member': { color: COLORS.badge.trusted, icon: 'shield-checkmark' },
  'Temple Volunteer': { color: COLORS.badge.volunteer, icon: 'heart' },
  'Event Organizer': { color: COLORS.badge.organizer, icon: 'calendar' },
  'Community Helper': { color: COLORS.success, icon: 'hand-left' },
  'Verified Vendor': { color: COLORS.badge.vendor, icon: 'storefront' },
  'Local Resident': { color: COLORS.info, icon: 'home' },
};

export const Badge: React.FC<BadgeProps> = ({ name, size = 'small' }) => {
  const config = BADGE_CONFIG[name] || { color: COLORS.textSecondary, icon: 'ribbon' };
  const iconSize = size === 'small' ? 12 : 16;
  const fontSize = size === 'small' ? 10 : 12;

  return (
    <View style={[styles.badge, { backgroundColor: `${config.color}20` }]}>
      <Ionicons name={config.icon} size={iconSize} color={config.color} />
      <Text style={[styles.text, { color: config.color, fontSize }]}>{name}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  text: {
    marginLeft: 4,
    fontWeight: '500',
  },
});
