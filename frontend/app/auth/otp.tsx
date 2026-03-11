import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/Button';
import { verifyOTP, sendOTP } from '../../src/services/api';
import { verifyFirebaseOTP, sendFirebaseOTP } from '../../src/services/firebase/authService';
import { useAuthStore } from '../../src/store/authStore';
import { COLORS, SPACING, BORDER_RADIUS } from '../../src/constants/theme';
import api from '../../src/services/api';

export default function OTPScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { login } = useAuthStore();
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(30);
  
  const inputRefs = useRef<TextInput[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleOtpChange = (index: number, value: string) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every((digit) => digit !== '')) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (otpCode?: string) => {
    const code = otpCode || otp.join('');
    if (code.length !== 6) {
      setError('Please enter complete OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Verify OTP with Firebase and get ID token
      const idToken = await verifyFirebaseOTP(code);
      
      // Send token to backend for verification and user creation
      const response = await api.post('/auth/verify-firebase-token', { id_token: idToken });
      const data = response.data;

      if (data.is_new_user) {
        router.push({ pathname: '/auth/profile', params: { phone: data.phone, firebase_uid: data.firebase_uid } });
      } else {
        await login(data.user, data.token);
        if (data.user.home_location || data.user.location) {
          router.replace('/(tabs)');
        } else {
          router.replace('/auth/address-entry');
        }
      }
    } catch (err: any) {
      console.error('[OTP] Verification error:', err);
      
      // Fallback to legacy OTP verification for testing
      try {
        const response = await verifyOTP(phone || '', code);
        const data = response.data;

        if (data.is_new_user) {
          router.push({ pathname: '/auth/profile', params: { phone } });
        } else {
          await login(data.user, data.token);
          if (data.user.home_location || data.user.location) {
            router.replace('/(tabs)');
          } else {
            router.replace('/auth/address-entry');
          }
        }
        return;
      } catch (legacyErr: any) {
        setError(err.message || legacyErr.response?.data?.detail || 'Invalid OTP. Please try again.');
      }
      
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    
    try {
      await sendFirebaseOTP(phone || '');
      setResendTimer(30);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP');
    }
  };

  // Format phone for display
  const displayPhone = phone?.replace('+91', '') || '';

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
            <Ionicons name="keypad" size={48} color={COLORS.primary} />
            <Text style={styles.title}>Verify OTP</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit code sent to {phone}
            </Text>
          </View>

          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref!)}
                style={[styles.otpInput, error && styles.otpInputError]}
                value={digit}
                onChangeText={(value) => handleOtpChange(index, value.replace(/[^0-9]/g, '').slice(0, 1))}
                onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
              />
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title={loading ? "Verifying..." : "Verify"}
            onPress={() => handleVerify()}
            loading={loading}
            disabled={otp.some((digit) => digit === '') || loading}
          />

          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResend}
            disabled={resendTimer > 0}
          >
            <Text style={[styles.resendText, resendTimer > 0 && styles.resendDisabled]}>
              {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
            </Text>
          </TouchableOpacity>
        </View>
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
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  otpInput: {
    width: 48,
    height: 56,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: COLORS.text,
  },
  otpInputError: {
    borderColor: COLORS.error,
  },
  error: {
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  resendButton: {
    marginTop: SPACING.lg,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  resendDisabled: {
    color: COLORS.textLight,
  },
});
