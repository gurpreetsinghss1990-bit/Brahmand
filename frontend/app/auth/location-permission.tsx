import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Button } from '../../src/components/Button';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reverseGeocode } from '../../src/services/api';

export default function LocationPermissionScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const requestPermission = async () => {
    setLoading(true);
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setPermissionDenied(true);
        setLoading(false);
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      
      // Reverse geocode to get address
      const response = await reverseGeocode(latitude, longitude);
      const detectedLocation = {
        country: response.data.country,
        state: response.data.state,
        city: response.data.city,
        area: response.data.area,
        latitude,
        longitude,
      };

      // Store detected location
      await AsyncStorage.setItem('detected_location', JSON.stringify(detectedLocation));

      // Navigate to verification screen
      router.push('/auth/location-verify');
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert(
        'Location Error',
        'Could not detect your location. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    // Skip location detection, use entered address directly
    await AsyncStorage.removeItem('detected_location');
    router.push('/auth/location-verify');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepText}>Step 2 of 3</Text>
          </View>
        </View>

        {/* Illustration */}
        <View style={styles.illustrationContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="navigate" size={64} color={COLORS.primary} />
          </View>
        </View>

        {/* Text Content */}
        <View style={styles.textContent}>
          <Text style={styles.title}>Enable Location Access</Text>
          <Text style={styles.subtitle}>
            We'll verify your location to ensure you join the right local communities
          </Text>
        </View>

        {/* Benefits */}
        <View style={styles.benefitsContainer}>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
            <Text style={styles.benefitText}>Auto-join local Sanatan communities</Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
            <Text style={styles.benefitText}>Connect with nearby devotees</Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
            <Text style={styles.benefitText}>Discover local temples & events</Text>
          </View>
        </View>

        {permissionDenied && (
          <View style={styles.warningBox}>
            <Ionicons name="warning" size={20} color={COLORS.warning} />
            <Text style={styles.warningText}>
              Location permission denied. You can still continue with the address you entered.
            </Text>
          </View>
        )}

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <Button
            title={loading ? 'Detecting Location...' : 'Allow Location Access'}
            onPress={requestPermission}
            disabled={loading}
            style={styles.primaryButton}
          />
          
          <Button
            title="Skip for Now"
            onPress={handleSkip}
            variant="outline"
            style={styles.skipButton}
          />
        </View>

        {/* Privacy Note */}
        <Text style={styles.privacyNote}>
          <Ionicons name="lock-closed" size={12} color={COLORS.textLight} />
          {' '}Your location data is only used for community matching
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
    padding: SPACING.lg,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  stepBadge: {
    backgroundColor: `${COLORS.primary}15`,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  stepText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  illustrationContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContent: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  benefitsContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  benefitText: {
    fontSize: 14,
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.warning}15`,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.warning,
    marginLeft: SPACING.sm,
  },
  buttonContainer: {
    gap: SPACING.sm,
  },
  primaryButton: {
    marginBottom: SPACING.xs,
  },
  skipButton: {
    borderColor: COLORS.divider,
  },
  privacyNote: {
    fontSize: 11,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});
