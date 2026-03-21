import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated,
  Dimensions,
  ImageBackground
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../src/store/authStore';
import { COLORS, SPACING } from '../src/constants/theme';

const { width, height } = Dimensions.get('window');

// Subtle mandala pattern SVG as background
const MandalaPattern = () => (
  <View style={styles.mandalaContainer}>
    <View style={styles.mandalaCircle} />
    <View style={[styles.mandalaCircle, styles.mandalaCircle2]} />
    <View style={[styles.mandalaCircle, styles.mandalaCircle3]} />
  </View>
);

export default function WelcomeScreen() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [agreed, setAgreed] = useState(false);
  
  const logoOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.location) {
        router.replace('/(tabs)');
      } else {
        router.replace('/auth/location');
      }
    }
  }, [isAuthenticated, user]);

  const handleContinue = () => {
    if (!agreed) return;
    
    // Fade out Om logo animation
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 0.8,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.push('/auth/phone');
    });
  };

  return (
    <LinearGradient
      colors={['#FF6600', '#FF9933']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Subtle Mandala Pattern */}
      <MandalaPattern />
      
      {/* Main Content */}
      <View style={styles.content}>
        {/* Om Logo */}
        <Animated.View 
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }]
            }
          ]}
        >
          <Text style={styles.omSymbol}>ॐ</Text>
        </Animated.View>

        {/* App Name */}
        <Text style={styles.appName}>Brahmand</Text>
        <Text style={styles.tagline}>The Sanatan Community</Text>
      </View>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        {/* Terms Checkbox */}
        <TouchableOpacity 
          style={styles.checkboxContainer}
          onPress={() => setAgreed(!agreed)}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.termsText}>
            I agree to the Terms of Service and Community Guidelines
          </Text>
        </TouchableOpacity>

        {/* Continue Button */}
        <TouchableOpacity
          style={[styles.continueButton, !agreed && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={!agreed}
          activeOpacity={0.9}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mandalaContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.08,
  },
  mandalaCircle: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  mandalaCircle2: {
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: width * 0.45,
  },
  mandalaCircle3: {
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: width * 0.3,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  logoContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  omSymbol: {
    fontSize: 100,
    color: '#FFFFFF',
    fontWeight: '300',
  },
  appName: {
    fontSize: 42,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  tagline: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.5,
  },
  bottomSection: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  checkboxChecked: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  checkmark: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
  },
  continueButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: SPACING.md + 2,
    borderRadius: 30,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
