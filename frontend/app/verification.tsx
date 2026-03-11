import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../src/components/Input';
import { Button } from '../src/components/Button';
import { requestVerification } from '../src/services/api';
import { useAuthStore } from '../src/store/authStore';
import { COLORS, SPACING, BORDER_RADIUS } from '../src/constants/theme';

export default function VerificationScreen() {
  const router = useRouter();
  const { updateUser } = useAuthStore();
  
  const [fullName, setFullName] = useState('');
  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const idTypes = [
    { value: 'aadhaar', label: 'Aadhaar Card' },
    { value: 'pan', label: 'PAN Card' },
    { value: 'voter_id', label: 'Voter ID' },
  ];

  const handleVerification = async () => {
    if (!fullName.trim() || !idType || !idNumber.trim()) {
      setError('Please fill all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await requestVerification({
        full_name: fullName.trim(),
        id_type: idType,
        id_number: idNumber.trim(),
      });
      
      updateUser({ is_verified: true, badges: ['Verified Member'] } as any);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color={COLORS.success} />
          </View>
          <Text style={styles.successTitle}>Verification Complete!</Text>
          <Text style={styles.successText}>
            You are now a Verified Member and can participate in all community discussions.
          </Text>
          <Button
            title="Go to Communities"
            onPress={() => router.replace('/(tabs)')}
            style={styles.successButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Shield Icon */}
            <View style={styles.iconContainer}>
              <Ionicons name="shield-checkmark" size={64} color={COLORS.primary} />
            </View>

            <Text style={styles.title}>Community Verification</Text>
            <Text style={styles.subtitle}>
              To participate in community discussions, please verify your account.
            </Text>
            <Text style={styles.description}>
              This helps keep Sanatan Lok safe, trusted, and authentic for everyone.
            </Text>

            {/* Form */}
            <View style={styles.form}>
              <Input
                label="Full Name (as on ID)"
                placeholder="Enter your full name"
                value={fullName}
                onChangeText={setFullName}
              />

              <Text style={styles.label}>ID Type</Text>
              <View style={styles.idTypeContainer}>
                {idTypes.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.idTypeButton,
                      idType === type.value && styles.idTypeButtonSelected,
                    ]}
                    onPress={() => setIdType(type.value)}
                  >
                    <Text
                      style={[
                        styles.idTypeText,
                        idType === type.value && styles.idTypeTextSelected,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Input
                label="ID Number"
                placeholder="Enter your ID number"
                value={idNumber}
                onChangeText={setIdNumber}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button
                title="Complete Verification"
                onPress={handleVerification}
                loading={loading}
                disabled={!fullName.trim() || !idType || !idNumber.trim()}
                style={styles.button}
              />

              <View style={styles.infoBox}>
                <Ionicons name="lock-closed" size={16} color={COLORS.info} />
                <Text style={styles.infoText}>
                  Your ID information is encrypted and secure. We only use it for verification purposes.
                </Text>
              </View>
            </View>
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
  header: {
    padding: SPACING.md,
  },
  backButton: {
    width: 40,
  },
  content: {
    paddingHorizontal: SPACING.lg,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  form: {
    marginTop: SPACING.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  idTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  idTypeButton: {
    flex: 1,
    minWidth: 100,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  idTypeButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  idTypeText: {
    fontSize: 13,
    color: COLORS.text,
  },
  idTypeTextSelected: {
    color: COLORS.textWhite,
    fontWeight: '600',
  },
  error: {
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  button: {
    marginTop: SPACING.md,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: `${COLORS.info}15`,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.lg,
  },
  infoText: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: 12,
    color: COLORS.info,
    lineHeight: 18,
  },
  // Success State
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  successIcon: {
    marginBottom: SPACING.lg,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  successText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  successButton: {
    width: '100%',
  },
});
