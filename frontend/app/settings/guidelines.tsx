import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

const GUIDELINES = [
  {
    icon: 'heart',
    title: 'Respect Sanatan Dharma Traditions',
    description: 'Honor and respect the teachings, rituals, and traditions of Sanatan Dharma. This community is dedicated to preserving and promoting Hindu culture.',
  },
  {
    icon: 'ban',
    title: 'No Anti-Hindu or Abusive Content',
    description: 'Content that disrespects, mocks, or attacks Hindu religion, deities, scriptures, or practices is strictly prohibited.',
  },
  {
    icon: 'shield-checkmark',
    title: 'No Religious Attacks',
    description: 'Do not engage in attacks against any religion or religious community. Maintain harmony and mutual respect.',
  },
  {
    icon: 'home',
    title: 'Respect Temples and Devotees',
    description: 'Show respect to temples, priests, and fellow devotees. Do not share misleading or false information about temples.',
  },
  {
    icon: 'people',
    title: 'Follow Moderator Instructions',
    description: 'Community moderators help maintain a positive environment. Follow their guidance and decisions.',
  },
  {
    icon: 'chatbubble-ellipses',
    title: 'Constructive Communication',
    description: 'Engage in meaningful discussions. Avoid spam, harassment, and personal attacks against other members.',
  },
  {
    icon: 'document-text',
    title: 'Authentic Information',
    description: 'Share only verified and authentic information about events, temples, and religious matters.',
  },
  {
    icon: 'lock-closed',
    title: 'Privacy and Safety',
    description: "Respect others' privacy. Do not share personal information of other members without consent.",
  },
];

export default function GuidelinesScreen() {
  const router = useRouter();

  const handleBack = useCallback(() => {
    router.replace('/profile');
  }, [router]);

  useEffect(() => {
    const backAction = () => {
      handleBack();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => subscription.remove();
  }, [handleBack]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Community Guidelines</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Introduction */}
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>Welcome to Sanatan Lok</Text>
          <Text style={styles.introText}>
            These guidelines help us maintain a respectful and positive community for all devotees. By using Sanatan Lok, you agree to follow these guidelines.
          </Text>
        </View>

        {/* Guidelines List */}
        <View style={styles.guidelinesContainer}>
          {GUIDELINES.map((guideline, index) => (
            <View key={index} style={styles.guidelineCard}>
              <View style={styles.guidelineIcon}>
                <Ionicons name={guideline.icon as any} size={24} color={COLORS.primary} />
              </View>
              <View style={styles.guidelineContent}>
                <Text style={styles.guidelineTitle}>{guideline.title}</Text>
                <Text style={styles.guidelineDescription}>{guideline.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Footer Note */}
        <View style={styles.footerCard}>
          <Ionicons name="information-circle" size={24} color={COLORS.warning} />
          <Text style={styles.footerText}>
            Violation of these guidelines may result in content removal, account suspension, or permanent ban. If you see content that violates these guidelines, please report it.
          </Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  scrollView: {
    flex: 1,
  },
  introCard: {
    backgroundColor: `${COLORS.primary}10`,
    margin: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  introText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
  },
  guidelinesContainer: {
    padding: SPACING.md,
    paddingTop: 0,
  },
  guidelineCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  guidelineIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  guidelineContent: {
    flex: 1,
  },
  guidelineTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  guidelineDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  footerCard: {
    flexDirection: 'row',
    backgroundColor: `${COLORS.warning}15`,
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'flex-start',
  },
  footerText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    marginLeft: SPACING.sm,
    lineHeight: 20,
  },
  bottomPadding: {
    height: SPACING.xl * 2,
  },
});
