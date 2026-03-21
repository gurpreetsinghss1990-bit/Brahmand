import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Button } from '../../src/components/Button';
import { setupDualLocation, reverseGeocode } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';

interface LocationData {
  country: string;
  state: string;
  city: string;
  area: string;
  latitude?: number;
  longitude?: number;
  display_name?: string;
}

export default function LocationSetupScreen() {
  const router = useRouter();
  const { updateUser } = useAuthStore();

  const [homeLocation, setHomeLocation] = useState<LocationData | null>(null);
  const [officeLocation, setOfficeLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [detectingHome, setDetectingHome] = useState(false);
  const [detectingOffice, setDetectingOffice] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'home' | 'office' | 'done'>('home');

  useEffect(() => {
    // Auto-detect home location on mount
    detectCurrentLocation('home');
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const msg = 'Please enable location access to auto-detect your area. This helps you join local communities.';
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Location Permission Required', msg, [{ text: 'OK' }]);
        }
        return false;
      }
      return true;
    } catch (error) {
      console.error('Permission request error:', error);
      if (Platform.OS === 'web') {
        window.alert('Location permission request failed. Please check your browser settings.');
      }
      return false;
    }
  };

  const detectCurrentLocation = async (type: 'home' | 'office') => {
    try {
      if (Platform.OS === 'web') {
        // Use browser native API if expo-location blocks it
        if (!navigator.geolocation) {
           setError('Geolocation is not supported by your browser');
           return;
        }
        
        if (type === 'home') setDetectingHome(true);
        else setDetectingOffice(true);
        setError('');

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const { latitude, longitude } = position.coords;
              const response = await reverseGeocode(latitude, longitude);
              const locationData: LocationData = {
                country: response.data.country,
                state: response.data.state,
                city: response.data.city,
                area: response.data.area,
                latitude,
                longitude,
                display_name: response.data.display_name,
              };

              if (type === 'home') {
                setHomeLocation(locationData);
                setStep('office');
              } else {
                setOfficeLocation(locationData);
                setStep('done');
              }
            } catch (apiErr: any) {
              console.error('Reverse geocode error:', apiErr);
              setError('Could not decode location. Please enter manually.');
            } finally {
              if (type === 'home') setDetectingHome(false);
              else setDetectingOffice(false);
            }
          },
          (geoError) => {
            console.error('Browser geolocation error:', geoError);
            setError(`Location error: ${geoError.message}. Please check browser permissions.`);
            if (type === 'home') setDetectingHome(false);
            else setDetectingOffice(false);
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 }
        );
        return;
      }

      // Native flow
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) return;

      if (type === 'home') setDetectingHome(true);
      else setDetectingOffice(true);
      setError('');

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      const response = await reverseGeocode(latitude, longitude);
      const locationData: LocationData = {
        country: response.data.country,
        state: response.data.state,
        city: response.data.city,
        area: response.data.area,
        latitude,
        longitude,
        display_name: response.data.display_name,
      };

      if (type === 'home') {
        setHomeLocation(locationData);
        setStep('office');
      } else {
        setOfficeLocation(locationData);
        setStep('done');
      }
    } catch (err: any) {
      console.error('Location detection error:', err);
      setError(`Location detection failed: ${err.message || 'Unknown error'}`);
    } finally {
      if (Platform.OS !== 'web') {
        if (type === 'home') {
          setDetectingHome(false);
        } else {
          setDetectingOffice(false);
        }
      }
    }
  };

  const handleSkipOffice = () => {
    setStep('done');
  };

  const handleSetupLocations = async () => {
    if (!homeLocation) {
      setError('Please set at least your home location');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await setupDualLocation({
        home_location: homeLocation,
        office_location: officeLocation || undefined,
      });

      updateUser(response.data.user);
      router.replace('/auth/entry-animation');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to setup locations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderLocationCard = (
    title: string,
    location: LocationData | null,
    isDetecting: boolean,
    onDetect: () => void,
    icon: keyof typeof Ionicons.glyphMap,
    color: string
  ) => (
    <View style={styles.locationCard}>
      <View style={styles.locationHeader}>
        <View style={[styles.locationIcon, { backgroundColor: `${color}20` }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
        <Text style={styles.locationTitle}>{title}</Text>
      </View>

      {location ? (
        <View style={styles.locationDetails}>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color={COLORS.success} />
            <Text style={styles.areaText}>{location.area}</Text>
          </View>
          <Text style={styles.addressText}>
            {location.city}, {location.state}
          </Text>
          <Text style={styles.countryText}>{location.country}</Text>
          
          <TouchableOpacity style={styles.changeButton} onPress={onDetect}>
            <Ionicons name="refresh" size={16} color={COLORS.primary} />
            <Text style={styles.changeText}>Re-detect Location</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity 
          style={styles.detectButton} 
          onPress={onDetect}
          disabled={isDetecting}
        >
          {isDetecting ? (
            <>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.detectingText}>Detecting your location...</Text>
            </>
          ) : (
            <>
              <Ionicons name="navigate" size={20} color={COLORS.primary} />
              <Text style={styles.detectText}>Detect Current Location</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="location" size={48} color={COLORS.primary} />
            <Text style={styles.title}>Set Your Locations</Text>
            <Text style={styles.subtitle}>
              We'll auto-detect your location and add you to local Sanatan communities
            </Text>
          </View>

          {/* Step Indicator */}
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, step !== 'home' && styles.stepDotComplete]}>
              {step !== 'home' ? (
                <Ionicons name="checkmark" size={14} color={COLORS.textWhite} />
              ) : (
                <Text style={styles.stepNumber}>1</Text>
              )}
            </View>
            <View style={[styles.stepLine, step !== 'home' && styles.stepLineComplete]} />
            <View style={[styles.stepDot, step === 'done' && styles.stepDotComplete]}>
              {step === 'done' ? (
                <Ionicons name="checkmark" size={14} color={COLORS.textWhite} />
              ) : (
                <Text style={styles.stepNumber}>2</Text>
              )}
            </View>
          </View>

          {/* Home Location */}
          {renderLocationCard(
            'Home Location',
            homeLocation,
            detectingHome,
            () => detectCurrentLocation('home'),
            'home',
            COLORS.success
          )}

          {/* Office Location - Show after home is set */}
          {step !== 'home' && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Required</Text>
                <View style={styles.dividerLine} />
              </View>

              {renderLocationCard(
                'Office Location',
                officeLocation,
                detectingOffice,
                () => detectCurrentLocation('office'),
                'business',
                COLORS.info
              )}

              {!officeLocation && step === 'office' && (
                <View style={styles.requiredNote}>
                  <Ionicons name="information-circle" size={16} color={COLORS.warning} />
                  <Text style={styles.requiredText}>Please detect your office location to continue</Text>
                </View>
              )}
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Info Box */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color={COLORS.info} />
            <Text style={styles.infoText}>
              Both locations are required. You'll be added to 5 communities based on your Home and Office areas for connecting with local Sanatan communities.
            </Text>
          </View>

          {/* Submit Button - Requires both home and office locations */}
          {homeLocation && officeLocation ? (
            <Button
              title="Join Communities"
              onPress={handleSetupLocations}
              loading={loading}
              style={styles.button}
            />
          ) : null}
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotComplete: {
    backgroundColor: COLORS.success,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: COLORS.border,
  },
  stepLineComplete: {
    backgroundColor: COLORS.success,
  },
  locationCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  locationDetails: {
    paddingLeft: 52,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  areaText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: SPACING.xs,
  },
  addressText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  countryText: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  changeText: {
    fontSize: 14,
    color: COLORS.primary,
    marginLeft: SPACING.xs,
  },
  detectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${COLORS.primary}10`,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  detectText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '500',
    marginLeft: SPACING.sm,
  },
  detectingText: {
    fontSize: 14,
    color: COLORS.primary,
    marginLeft: SPACING.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: SPACING.md,
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  skipText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
  },
  requiredNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    marginTop: SPACING.xs,
  },
  requiredText: {
    fontSize: 13,
    color: COLORS.warning,
    marginLeft: SPACING.xs,
  },
  error: {
    color: COLORS.error,
    textAlign: 'center',
    marginVertical: SPACING.md,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: `${COLORS.info}15`,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginVertical: SPACING.lg,
  },
  infoText: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: 13,
    color: COLORS.info,
    lineHeight: 18,
  },
  button: {
    marginTop: SPACING.md,
  },
});
