import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/Button';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

export default function DeclarationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone: string; firebase_uid?: string }>();
  const [agreed, setAgreed] = useState(false);

  const handleContinue = () => {
    if (agreed) {
      router.push({ 
        pathname: '/auth/profile', 
        params: { phone: params.phone, firebase_uid: params.firebase_uid } 
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color={COLORS.text} />
      </TouchableOpacity>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Text style={styles.omSymbol}>\u0950</Text>
            </View>
            <Text style={styles.title}>Sanatan Declaration</Text>
          </View>

          {/* Declaration Text */}
          <View style={styles.declarationCard}>
            <Text style={styles.declarationText}>
              Sanatan Lok is a community platform dedicated to Sanatan Dharma, temples, festivals and Hindu culture.
            </Text>
            <Text style={styles.declarationText}>
              By joining you agree to respect Sanatan Dharma traditions and maintain a positive environment for devotees.
            </Text>
          </View>

          {/* Values Section */}
          <View style={styles.valuesSection}>
            <Text style={styles.valuesTitle}>Our Values</Text>
            <View style={styles.valueItem}>
              <Ionicons name="heart" size={20} color={COLORS.primary} />
              <Text style={styles.valueText}>Respect for Sanatan Dharma traditions</Text>
            </View>
            <View style={styles.valueItem}>
              <Ionicons name="people" size={20} color={COLORS.primary} />
              <Text style={styles.valueText}>Positive community for devotees</Text>
            </View>
            <View style={styles.valueItem}>
              <Ionicons name="home" size={20} color={COLORS.primary} />
              <Text style={styles.valueText}>Connection with temples and events</Text>
            </View>
            <View style={styles.valueItem}>
              <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} />
              <Text style={styles.valueText}>Safe space for spiritual growth</Text>
            </View>
          </View>

          {/* Checkbox */}
          <TouchableOpacity 
            style={styles.checkboxContainer}
            onPress={() => setAgreed(!agreed)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed && <Ionicons name="checkmark" size={16} color={COLORS.textWhite} />}
            </View>
            <Text style={styles.checkboxText}>
              I respect Sanatan Dharma values and community guidelines.
            </Text>
          </TouchableOpacity>

          {/* Continue Button */}
          <Button
            title="Continue"
            onPress={handleContinue}
            disabled={!agreed}
            style={styles.button}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backButton: {
    padding: SPACING.md,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  omSymbol: {
    fontSize: 48,
    color: COLORS.primary,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  declarationCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  declarationText: {
    fontSize: 15,
    lineHeight: 24,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  valuesSection: {
    marginBottom: SPACING.xl,
  },
  valuesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  valueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  valueText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: SPACING.md,
    flex: 1,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xl,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
  },
  checkboxText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  button: {
    marginTop: SPACING.md,
  },
});
