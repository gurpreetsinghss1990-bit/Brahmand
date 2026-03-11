import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { sendOTP } from '../../src/services/api';
import { sendFirebaseOTP } from '../../src/services/firebase/authService';
import { COLORS, SPACING } from '../../src/constants/theme';

export default function PhoneScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async () => {
    if (phone.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formattedPhone = `+91${phone}`;
      
      // Send OTP via Firebase
      await sendFirebaseOTP(formattedPhone);
      
      // Also notify backend for tracking
      try {
        await sendOTP(formattedPhone);
      } catch (e) {
        // Backend tracking is optional
        console.log('[Phone] Backend notification failed (non-critical)');
      }
      
      router.push({ pathname: '/auth/otp', params: { phone: formattedPhone } });
    } catch (err: any) {
      console.error('[Phone] OTP error:', err);
      setError(err.message || 'Failed to send OTP. Please try again.');
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
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.header}>
            <Ionicons name="phone-portrait" size={48} color={COLORS.primary} />
            <Text style={styles.title}>Enter Your Phone Number</Text>
            <Text style={styles.subtitle}>
              We'll send you a verification code via SMS
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.phoneInputContainer}>
              <View style={styles.countryCode}>
                <Text style={styles.countryCodeText}>+91</Text>
              </View>
              <View style={styles.phoneInput}>
                <Input
                  placeholder="Enter phone number"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text.replace(/[^0-9]/g, '').slice(0, 10));
                    setError('');
                  }}
                  maxLength={10}
                  error={error}
                />
              </View>
            </View>

            <Button
              title={loading ? "Sending OTP..." : "Send OTP"}
              onPress={handleSendOTP}
              loading={loading}
              disabled={phone.length < 10 || loading}
            />

            <Text style={styles.infoNote}>
              A 6-digit verification code will be sent to your phone
            </Text>
          </View>
        </View>
        
        {/* reCAPTCHA container for web */}
        {Platform.OS === 'web' && <View nativeID="recaptcha-container" />}
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
  backButton: {
    padding: SPACING.md,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl * 2,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  form: {
    flex: 1,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  countryCode: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  phoneInput: {
    flex: 1,
  },
  infoNote: {
    marginTop: SPACING.lg,
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
