import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../src/store/authStore';
import { COLORS, SPACING, BORDER_RADIUS } from '../src/constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.location) {
        router.replace('/(tabs)');
      } else {
        router.replace('/auth/location');
      }
    }
  }, [isAuthenticated, user]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="flower" size={60} color={COLORS.primary} />
          </View>
          <Text style={styles.appName}>Sanatan Lok</Text>
          <Text style={styles.tagline}>Connecting Sanatan Communities Across Bharat</Text>
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <View style={styles.featureRow}>
            <View style={styles.featureItem}>
              <Ionicons name="people" size={28} color={COLORS.primary} />
              <Text style={styles.featureText}>Communities</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="chatbubbles" size={28} color={COLORS.primary} />
              <Text style={styles.featureText}>Messaging</Text>
            </View>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.featureItem}>
              <Ionicons name="calendar" size={28} color={COLORS.primary} />
              <Text style={styles.featureText}>Events</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="shield-checkmark" size={28} color={COLORS.primary} />
              <Text style={styles.featureText}>Privacy</Text>
            </View>
          </View>
        </View>

        {/* Get Started Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/auth/phone')}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={20} color={COLORS.textWhite} />
        </TouchableOpacity>

        <Text style={styles.footerText}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl * 2,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  tagline: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  featuresContainer: {
    marginBottom: SPACING.xl * 2,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: SPACING.lg,
  },
  featureItem: {
    alignItems: 'center',
    width: 120,
  },
  featureText: {
    marginTop: SPACING.sm,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  buttonText: {
    color: COLORS.textWhite,
    fontSize: 18,
    fontWeight: '600',
    marginRight: SPACING.sm,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: 'center',
  },
});
