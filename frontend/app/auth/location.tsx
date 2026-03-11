import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { setupLocation } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { COLORS, SPACING, BORDER_RADIUS, INDIA_STATES } from '../../src/constants/theme';

export default function LocationSetupScreen() {
  const router = useRouter();
  const { updateUser } = useAuthStore();

  const [country] = useState('Bharat');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showStates, setShowStates] = useState(false);

  const handleSetupLocation = async () => {
    if (!state || !city.trim() || !area.trim()) {
      setError('Please fill in all location fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await setupLocation({
        country,
        state,
        city: city.trim(),
        area: area.trim(),
      });

      updateUser(response.data.user);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to setup location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Ionicons name="location" size={48} color={COLORS.primary} />
              <Text style={styles.title}>Set Your Location</Text>
              <Text style={styles.subtitle}>
                Join local Sanatan communities based on your area
              </Text>
            </View>

            {/* Country (fixed) */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Country</Text>
              <View style={styles.fixedField}>
                <Ionicons name="flag" size={20} color={COLORS.primary} />
                <Text style={styles.fixedText}>{country}</Text>
              </View>
            </View>

            {/* State Selection */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>State</Text>
              <TouchableOpacity
                style={styles.selectField}
                onPress={() => setShowStates(!showStates)}
              >
                <Text style={[styles.selectText, !state && styles.placeholder]}>
                  {state || 'Select your state'}
                </Text>
                <Ionicons name={showStates ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>

              {showStates && (
                <ScrollView style={styles.dropdown} nestedScrollEnabled>
                  {INDIA_STATES.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.dropdownItem, state === s && styles.dropdownItemSelected]}
                      onPress={() => {
                        setState(s);
                        setShowStates(false);
                      }}
                    >
                      <Text style={[styles.dropdownText, state === s && styles.dropdownTextSelected]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* City Input */}
            <Input
              label="City"
              placeholder="Enter your city (e.g., Mumbai)"
              value={city}
              onChangeText={setCity}
            />

            {/* Area Input */}
            <Input
              label="Area / Locality"
              placeholder="Enter your area (e.g., Borivali)"
              value={area}
              onChangeText={setArea}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color={COLORS.info} />
              <Text style={styles.infoText}>
                You'll automatically join communities for your area, city, state, and country.
              </Text>
            </View>

            <Button
              title="Join Communities"
              onPress={handleSetupLocation}
              loading={loading}
              disabled={!state || !city.trim() || !area.trim()}
              style={styles.button}
            />
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
  keyboardView: {
    flex: 1,
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
    marginBottom: SPACING.xl * 2,
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
  },
  fieldContainer: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  fixedField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
  },
  fixedText: {
    marginLeft: SPACING.sm,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
  },
  selectText: {
    fontSize: 16,
    color: COLORS.text,
  },
  placeholder: {
    color: COLORS.textLight,
  },
  dropdown: {
    maxHeight: 200,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.xs,
  },
  dropdownItem: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  dropdownItemSelected: {
    backgroundColor: `${COLORS.primary}15`,
  },
  dropdownText: {
    fontSize: 14,
    color: COLORS.text,
  },
  dropdownTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  error: {
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: SPACING.md,
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
  button: {
    marginTop: SPACING.md,
  },
});
