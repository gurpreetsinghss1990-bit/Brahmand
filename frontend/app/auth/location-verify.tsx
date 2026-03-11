import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/Button';
import { setupDualLocation } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AddressData {
  city: string;
  area: string;
}

interface LocationData {
  country: string;
  state: string;
  city: string;
  area: string;
  latitude?: number;
  longitude?: number;
}

export default function LocationVerifyScreen() {
  const router = useRouter();
  const { updateUser } = useAuthStore();
  
  const [enteredAddress, setEnteredAddress] = useState<{ home: AddressData; office: AddressData | null } | null>(null);
  const [detectedLocation, setDetectedLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mismatch, setMismatch] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const enteredStr = await AsyncStorage.getItem('entered_addresses');
      const detectedStr = await AsyncStorage.getItem('detected_location');
      
      if (enteredStr) {
        setEnteredAddress(JSON.parse(enteredStr));
      }
      
      if (detectedStr) {
        setDetectedLocation(JSON.parse(detectedStr));
      }

      // Check for mismatch
      if (enteredStr && detectedStr) {
        const entered = JSON.parse(enteredStr);
        const detected = JSON.parse(detectedStr);
        
        const cityMatch = entered.home.city.toLowerCase() === detected.city.toLowerCase();
        const areaMatch = entered.home.area.toLowerCase() === detected.area.toLowerCase();
        
        if (!cityMatch || !areaMatch) {
          setMismatch(true);
          // Show alert for mismatch
          setTimeout(() => {
            Alert.alert(
              'Location Mismatch',
              `Your entered address (${entered.home.area}, ${entered.home.city}) doesn't match your detected location (${detected.area}, ${detected.city}). Please verify which location you want to use.`,
              [{ text: 'OK', onPress: () => {} }]
            );
          }, 500);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUseEntered = async () => {
    if (!enteredAddress) return;
    await saveLocation({
      country: 'Bharat',
      state: detectedLocation?.state || 'Unknown',
      city: enteredAddress.home.city,
      area: enteredAddress.home.area,
    }, enteredAddress.office ? {
      country: 'Bharat',
      state: detectedLocation?.state || 'Unknown',
      city: enteredAddress.office.city,
      area: enteredAddress.office.area,
    } : null);
  };

  const handleUseDetected = async () => {
    if (!detectedLocation) return;
    await saveLocation(detectedLocation, null);
  };

  const saveLocation = async (homeLocation: LocationData, officeLocation: LocationData | null) => {
    setSaving(true);
    
    try {
      const response = await setupDualLocation({
        home_location: homeLocation,
        office_location: officeLocation || undefined,
      });

      // Clean up stored data
      await AsyncStorage.removeItem('entered_addresses');
      await AsyncStorage.removeItem('detected_location');

      updateUser(response.data.user);
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save location');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Verifying locations...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepText}>Step 3 of 3</Text>
          </View>
          <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
          <Text style={styles.title}>Verify Your Location</Text>
          <Text style={styles.subtitle}>
            {mismatch 
              ? 'We detected a different location. Please choose which address to use.'
              : 'Confirm your location to join local communities'
            }
          </Text>
        </View>

        {/* Mismatch Alert */}
        {mismatch && (
          <View style={styles.mismatchAlert}>
            <Ionicons name="warning" size={24} color={COLORS.warning} />
            <Text style={styles.mismatchText}>Location mismatch detected</Text>
          </View>
        )}

        {/* Entered Address Card */}
        {enteredAddress && (
          <View style={[styles.locationCard, mismatch && styles.locationCardHighlight]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: `${COLORS.primary}20` }]}>
                <Ionicons name="create" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.cardTitle}>Entered Address</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.locationMain}>{enteredAddress.home.area}</Text>
              <Text style={styles.locationSub}>{enteredAddress.home.city}, Bharat</Text>
              {enteredAddress.office && (
                <Text style={styles.officeNote}>
                  Office: {enteredAddress.office.area}, {enteredAddress.office.city}
                </Text>
              )}
            </View>
            <Button
              title={saving ? 'Saving...' : 'Use This Address'}
              onPress={handleUseEntered}
              disabled={saving}
              style={styles.cardButton}
            />
          </View>
        )}

        {/* Detected Location Card */}
        {detectedLocation && (
          <View style={[styles.locationCard, !mismatch && styles.locationCardHighlight]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: `${COLORS.success}20` }]}>
                <Ionicons name="navigate" size={20} color={COLORS.success} />
              </View>
              <Text style={styles.cardTitle}>Detected Location</Text>
              <View style={styles.gpsBadge}>
                <Ionicons name="location" size={10} color={COLORS.success} />
                <Text style={styles.gpsText}>GPS</Text>
              </View>
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.locationMain}>{detectedLocation.area}</Text>
              <Text style={styles.locationSub}>
                {detectedLocation.city}, {detectedLocation.state}
              </Text>
              <Text style={styles.countryText}>{detectedLocation.country}</Text>
            </View>
            <Button
              title={saving ? 'Saving...' : 'Use Detected Location'}
              onPress={handleUseDetected}
              disabled={saving}
              variant={mismatch ? 'outline' : 'primary'}
              style={styles.cardButton}
            />
          </View>
        )}

        {/* No detected location - just use entered */}
        {!detectedLocation && enteredAddress && !mismatch && (
          <View style={styles.noDetectionNote}>
            <Ionicons name="information-circle" size={20} color={COLORS.textSecondary} />
            <Text style={styles.noDetectionText}>
              Location detection was skipped. We'll use your entered address.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
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
    marginBottom: SPACING.md,
  },
  stepText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 20,
  },
  mismatchAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.warning}15`,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  mismatchText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.warning,
    marginLeft: SPACING.sm,
  },
  locationCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  locationCardHighlight: {
    borderColor: COLORS.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  gpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.success}15`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  gpsText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.success,
    marginLeft: 2,
  },
  cardContent: {
    marginBottom: SPACING.md,
  },
  locationMain: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  locationSub: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  countryText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  officeNote: {
    fontSize: 12,
    color: COLORS.secondary,
    marginTop: SPACING.sm,
    fontStyle: 'italic',
  },
  cardButton: {
    marginTop: SPACING.sm,
  },
  noDetectionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  noDetectionText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },
});
