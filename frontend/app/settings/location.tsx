import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, BackHandler } from 'react-native';
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

export default function ChangeLocationScreen() {
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

  const { user, updateUser } = useAuthStore();

  const [homeLocation, setHomeLocation] = useState<LocationData | null>(
    user?.home_location || null
  );
  const [officeLocation, setOfficeLocation] = useState<LocationData | null>(
    user?.office_location || null
  );
  const [loading, setLoading] = useState(false);
  const [detectingHome, setDetectingHome] = useState(false);
  const [detectingOffice, setDetectingOffice] = useState(false);
  const [error, setError] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const msg = 'Please enable location access to detect your area.';
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

              if (type === 'home') setHomeLocation(locationData);
              else setOfficeLocation(locationData);
              setHasChanges(true);
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

      if (type === 'home') setHomeLocation(locationData);
      else setOfficeLocation(locationData);
      setHasChanges(true);
    } catch (err: any) {
      console.error('Location detection error:', err);
      setError(`Location detection failed: ${err.message || 'Unknown error'}`);
    } finally {
      if (Platform.OS !== 'web') {
        if (type === 'home') setDetectingHome(false);
        else setDetectingOffice(false);
      }
    }
  };

  const handleUpdateLocations = async () => {
    if (!homeLocation || !officeLocation) {
      setError('Both home and office locations are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await setupDualLocation({
        home_location: homeLocation,
        office_location: officeLocation,
      });

      updateUser(response.data.user);
      
      Alert.alert(
        'Location Updated',
        'Your communities have been updated based on your new locations.',
        [{ text: 'OK', onPress: handleBack }]
      );
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update locations. Please try again.');
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
            <Ionicons name="navigate" size={16} color={COLORS.primary} />
            <Text style={styles.changeText}>Detect New Location</Text>
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
              <Text style={styles.detectText}>Detect Location</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Location</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Info Box */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color={COLORS.info} />
            <Text style={styles.infoText}>
              Changing your location will automatically update your community memberships. You will leave old location communities and join new ones.
            </Text>
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

          {/* Office Location */}
          <View style={styles.divider} />
          {renderLocationCard(
            'Office Location',
            officeLocation,
            detectingOffice,
            () => detectCurrentLocation('office'),
            'business',
            COLORS.info
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Community Preview */}
          {homeLocation && officeLocation && (
            <View style={styles.previewBox}>
              <Text style={styles.previewTitle}>Your Communities After Update:</Text>
              <View style={styles.previewItem}>
                <Ionicons name="home" size={16} color={COLORS.success} />
                <Text style={styles.previewText}>{homeLocation.area} Community</Text>
              </View>
              <View style={styles.previewItem}>
                <Ionicons name="business" size={16} color={COLORS.info} />
                <Text style={styles.previewText}>{officeLocation.area} Office Community</Text>
              </View>
              <View style={styles.previewItem}>
                <Ionicons name="location" size={16} color="#9B59B6" />
                <Text style={styles.previewText}>{homeLocation.city} Community</Text>
              </View>
              <View style={styles.previewItem}>
                <Ionicons name="map" size={16} color={COLORS.warning} />
                <Text style={styles.previewText}>{homeLocation.state} Community</Text>
              </View>
              <View style={styles.previewItem}>
                <Ionicons name="flag" size={16} color={COLORS.primary} />
                <Text style={styles.previewText}>Bharat Community</Text>
              </View>
            </View>
          )}

          {/* Update Button */}
          {homeLocation && officeLocation && hasChanges && (
            <Button
              title="Update Location & Communities"
              onPress={handleUpdateLocations}
              loading={loading}
              style={styles.button}
            />
          )}
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
  content: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: `${COLORS.info}15`,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  infoText: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: 13,
    color: COLORS.info,
    lineHeight: 18,
  },
  locationCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    overflow: 'hidden',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  locationTitle: {
    fontSize: 16,
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
    height: SPACING.md,
  },
  error: {
    color: COLORS.error,
    textAlign: 'center',
    marginVertical: SPACING.md,
  },
  previewBox: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.lg,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  previewText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },
  button: {
    marginTop: SPACING.lg,
  },
});
