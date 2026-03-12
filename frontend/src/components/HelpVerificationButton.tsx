import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';

interface HelpVerificationButtonProps {
  verifications: number;
  verifiedBy: string[];
  currentUserId: string;
  onVerify: () => void;
}

export const HelpVerificationButton: React.FC<HelpVerificationButtonProps> = ({
  verifications,
  verifiedBy,
  currentUserId,
  onVerify,
}) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const hasVerified = verifiedBy.includes(currentUserId);
  const isVerified = verifications >= 3;

  const handleVerify = () => {
    if (hasVerified) {
      Alert.alert('Already Verified', 'You have already verified this request.');
      return;
    }

    Alert.alert(
      'Verify Request',
      'Do you personally know this request is real?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes',
          onPress: () => {
            Alert.alert(
              'Confirm Verification',
              'Confirm verification. False verification may reduce your community trust score.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Confirm Verification',
                  onPress: () => {
                    onVerify();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Verification Count */}
      <View style={styles.countContainer}>
        {isVerified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        )}
        <Text style={styles.countText}>
          Verified by {verifications} community member{verifications !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Verify Button */}
      {!hasVerified && (
        <TouchableOpacity
          style={[
            styles.verifyButton,
            hasVerified && styles.verifyButtonDisabled,
          ]}
          onPress={handleVerify}
          disabled={hasVerified}
        >
          <Ionicons name="shield-checkmark" size={16} color={hasVerified ? COLORS.textLight : COLORS.primary} />
          <Text style={[styles.verifyButtonText, hasVerified && styles.verifyButtonTextDisabled]}>
            Verify Request
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.sm,
  },
  countContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.success}15`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: SPACING.sm,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.success,
    marginLeft: 3,
  },
  countText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}10`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    alignSelf: 'flex-start',
  },
  verifyButtonDisabled: {
    backgroundColor: COLORS.divider,
  },
  verifyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 6,
  },
  verifyButtonTextDisabled: {
    color: COLORS.textLight,
  },
});
