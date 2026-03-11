import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated,
  Linking,
  ScrollView,
  Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../src/store/authStore';
import { COLORS, SPACING, BORDER_RADIUS } from '../src/constants/theme';

const { width } = Dimensions.get('window');

const FEATURES = [
  {
    icon: 'people',
    title: 'Join Local Hindu Communities',
    description: 'Connect with devotees in your area',
  },
  {
    icon: 'chatbubbles',
    title: 'Private Messaging',
    description: 'Secure conversations with fellow members',
  },
  {
    icon: 'calendar',
    title: 'Temple Events & Festivals',
    description: 'Stay updated on pujas and celebrations',
  },
  {
    icon: 'shield-checkmark',
    title: 'Privacy & Verified Users',
    description: 'Safe and trusted community',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];
  const buttonScale = useState(new Animated.Value(1))[0];

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.location) {
        router.replace('/(tabs)');
      } else {
        router.replace('/auth/location');
      }
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleGetStarted = () => {
    if (!termsAccepted) return;
    
    // Button press animation
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.push('/auth/phone');
    });
  };

  const openTerms = () => {
    router.push('/settings/guidelines');
  };

  const openPrivacy = () => {
    router.push('/settings/guidelines');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }
          ]}
        >
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.logoContainer}>
              <LinearGradient
                colors={['#FF9933', '#FF6600']}
                style={styles.logoGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.omSymbol}>ॐ</Text>
              </LinearGradient>
            </View>
            <Text style={styles.appName}>Sanatan Lok</Text>
            <Text style={styles.tagline}>
              Connecting Sanatan Communities{'\n'}Across Bharat
            </Text>
          </View>

          {/* Features Section */}
          <View style={styles.featuresSection}>
            {FEATURES.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name={feature.icon as any} size={22} color={COLORS.primary} />
                </View>
                <View style={styles.featureTextContainer}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Terms Checkbox */}
          <TouchableOpacity 
            style={styles.termsContainer}
            onPress={() => setTermsAccepted(!termsAccepted)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
              {termsAccepted && (
                <Ionicons name="checkmark" size={16} color={COLORS.textWhite} />
              )}
            </View>
            <Text style={styles.termsText}>
              I agree to the{' '}
              <Text style={styles.termsLink} onPress={openTerms}>
                Terms of Service
              </Text>
              {' '}and{' '}
              <Text style={styles.termsLink} onPress={openPrivacy}>
                Community Guidelines
              </Text>
              {' '}of Sanatan Lok.
            </Text>
          </TouchableOpacity>

          {/* Get Started Button */}
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              onPress={handleGetStarted}
              activeOpacity={0.9}
              disabled={!termsAccepted}
            >
              <LinearGradient
                colors={termsAccepted ? ['#FF9933', '#FF6600'] : ['#CCCCCC', '#AAAAAA']}
                style={[styles.button, !termsAccepted && styles.buttonDisabled]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.buttonText}>Get Started</Text>
                <View style={styles.buttonIconContainer}>
                  <Ionicons name="arrow-forward" size={20} color={COLORS.textWhite} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Subtle Footer */}
          <Text style={styles.footerText}>
            Join thousands of devotees across Bharat
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFAF5',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl * 2,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl * 1.5,
  },
  logoContainer: {
    marginBottom: SPACING.lg,
  },
  logoGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6600',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  omSymbol: {
    fontSize: 72,
    color: COLORS.textWhite,
    fontWeight: '300',
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.5,
    marginBottom: SPACING.sm,
  },
  tagline: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresSection: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  featureIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF5EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 13,
    color: '#888888',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#F0F0F0',
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
  termsText: {
    flex: 1,
    fontSize: 14,
    color: '#444444',
    lineHeight: 22,
  },
  termsLink: {
    color: COLORS.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md + 4,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: COLORS.textWhite,
    fontSize: 18,
    fontWeight: '700',
    marginRight: SPACING.sm,
  },
  buttonIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#AAAAAA',
    textAlign: 'center',
  },
});
