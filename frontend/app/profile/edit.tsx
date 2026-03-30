import React, { useEffect, useMemo, useState } from 'react';
import * as Location from 'expo-location';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { BORDER_RADIUS, COLORS, SPACING } from '../../src/constants/theme';
import { getUserProfile, updateExtendedProfile } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';

export default function EditProfileScreen() {
  const router = useRouter();
  const { updateUser } = useAuthStore();
  const handleBack = () => {
    router.replace('/(tabs)/profile');
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [language, setLanguage] = useState('');
  const [kuldevi, setKuldevi] = useState('');
  const [kuldeviTempleArea, setKuldeviTempleArea] = useState('');
  const [gotra, setGotra] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [timeOfBirth, setTimeOfBirth] = useState('');
  const [placeOfBirth, setPlaceOfBirth] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await getUserProfile();
        const data = response.data || {};
        const homeLocation = data.home_location || data.location || {};

        setName(data.name || '');
        setLanguage(data.language || '');
        setKuldevi(data.kuldevi || '');
        setKuldeviTempleArea(data.kuldevi_temple_area || '');
        setGotra(data.gotra || '');
        setDateOfBirth(data.date_of_birth || '');
        setTimeOfBirth(data.time_of_birth || '');
        setPlaceOfBirth(
          data.place_of_birth ||
            [homeLocation.area, homeLocation.city, homeLocation.state].filter(Boolean).join(', ')
        );
      } catch (err: any) {
        setError(err?.response?.data?.detail || err?.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const astrologyReady = useMemo(() => {
    return Boolean(dateOfBirth.trim() && timeOfBirth.trim() && placeOfBirth.trim());
  }, [dateOfBirth, placeOfBirth, timeOfBirth]);

  const validate = () => {
    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth.trim())) {
      return 'Date of birth must be in YYYY-MM-DD format';
    }
    if (timeOfBirth && !/^\d{2}:\d{2}$/.test(timeOfBirth.trim())) {
      return 'Time of birth must be in HH:MM format';
    }
    return '';
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');
    try {
      // Attempt to geocode the entered place to coordinates so astrology can use exact birth location
      let lat: number | undefined;
      let lng: number | undefined;
      const placeText = placeOfBirth.trim();
      if (placeText) {
        try {
          const results = await Location.geocodeAsync(placeText);
          if (Array.isArray(results) && results.length > 0) {
            lat = results[0].latitude;
            lng = results[0].longitude;
          }
        } catch {
          // geocodeAsync may not be available on all platforms; fallback to Nominatim lookup
          try {
            const q = encodeURIComponent(placeText);
            const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}`);
            const data = await resp.json();
            if (Array.isArray(data) && data.length > 0) {
              lat = parseFloat(data[0].lat);
              lng = parseFloat(data[0].lon);
            }
          } catch {
            // ignore geocoding failure — we'll still save the textual place
          }
        }
      }

      const response = await updateExtendedProfile({
        name: name.trim() || undefined,
        language: language.trim() || undefined,
        kuldevi: kuldevi.trim() || undefined,
        kuldevi_temple_area: kuldeviTempleArea.trim() || undefined,
        gotra: gotra.trim() || undefined,
        date_of_birth: dateOfBirth.trim() || undefined,
        time_of_birth: timeOfBirth.trim() || undefined,
        place_of_birth: placeText || undefined,
        place_of_birth_latitude: lat,
        place_of_birth_longitude: lng,
      });

      updateUser(response.data || {});
      Alert.alert(
        'Profile Updated',
        astrologyReady
          ? 'Your birth details are saved. Horoscope and astrology can reuse them across the app.'
          : 'Your profile details were updated.',
        [{ text: 'OK', onPress: handleBack }],
      );
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.heroCard}>
              <Text style={styles.heroTitle}>Astrology Profile</Text>
              <Text style={styles.heroText}>
                Save your birth details once here. Horoscope and astrology pages will reuse them everywhere in the app.
              </Text>
              <View style={[styles.statusBadge, astrologyReady ? styles.statusBadgeReady : styles.statusBadgePending]}>
                <Ionicons
                  name={astrologyReady ? 'checkmark-circle' : 'alert-circle'}
                  size={16}
                  color={astrologyReady ? COLORS.success : COLORS.warning}
                />
                <Text style={[styles.statusText, astrologyReady ? styles.statusTextReady : styles.statusTextPending]}>
                  {astrologyReady ? 'Astrology ready' : 'Birth details missing'}
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Basic Info</Text>
              <View style={styles.card}>
                <Input label="Name" value={name} onChangeText={setName} placeholder="Enter your name" />
                <Input label="Language" value={language} onChangeText={setLanguage} placeholder="Preferred language" />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Birth Details</Text>
              <View style={styles.card}>
                <Input
                  label="Date of Birth"
                  value={dateOfBirth}
                  onChangeText={setDateOfBirth}
                  placeholder="YYYY-MM-DD"
                  keyboardType="numbers-and-punctuation"
                />
                <Input
                  label="Time of Birth"
                  value={timeOfBirth}
                  onChangeText={setTimeOfBirth}
                  placeholder="HH:MM"
                  keyboardType="numbers-and-punctuation"
                />
                <Input
                  label="Place of Birth"
                  value={placeOfBirth}
                  onChangeText={setPlaceOfBirth}
                  placeholder="City, State, Country"
                />
                <Text style={styles.helperText}>
                  These three fields are what the horoscope and astrology features need. Once saved, the app uses them automatically.
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Optional Spiritual Details</Text>
              <View style={styles.card}>
                <Input label="Kuldevi / Kuldevta" value={kuldevi} onChangeText={setKuldevi} placeholder="Optional" />
                <Input
                  label="Kuldevi Temple Area"
                  value={kuldeviTempleArea}
                  onChangeText={setKuldeviTempleArea}
                  placeholder="Optional"
                />
                <Input label="Gotra" value={gotra} onChangeText={setGotra} placeholder="Optional" />
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Button title="Save Profile" onPress={handleSave} loading={saving} style={styles.saveButton} />
            <View style={styles.bottomPadding} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardWrap: {
    flex: 1,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSpacer: {
    width: 24,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: SPACING.md,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.sm,
    color: COLORS.textSecondary,
  },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  heroText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  statusBadge: {
    marginTop: SPACING.md,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    borderRadius: BORDER_RADIUS.full,
  },
  statusBadgeReady: {
    backgroundColor: `${COLORS.success}15`,
  },
  statusBadgePending: {
    backgroundColor: `${COLORS.warning}18`,
  },
  statusText: {
    marginLeft: 6,
    fontWeight: '700',
    fontSize: 12,
  },
  statusTextReady: {
    color: COLORS.success,
  },
  statusTextPending: {
    color: COLORS.warning,
  },
  section: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  helperText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: SPACING.md,
  },
  saveButton: {
    marginTop: SPACING.sm,
  },
  bottomPadding: {
    height: SPACING.xl,
  },
});
