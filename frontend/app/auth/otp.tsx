import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { verifyOTP, sendOTP } from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { COLORS, SPACING } from '../../src/constants/theme';

const { width } = Dimensions.get('window');

const MandalaPattern = () => (
  <View style={styles.mandalaContainer}>
    <View style={styles.mandalaCircle} />
    <View style={[styles.mandalaCircle, styles.mandalaCircle2]} />
  </View>
);

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
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every(digit => digit !== '')) {
      verifyCode(newOtp.join(''));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyCode = async (code: string) => {
    setLoading(true);
    setError('');

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
          router.replace('/auth/location');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid OTP. Please try again.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    try {
      await sendOTP(phone || '');
      setResendTimer(30);
      setError('');
    } catch (err) {
      setError('Failed to resend OTP');
    }
  };

  return (
    <LinearGradient
      colors={['#FF6600', '#FF9933']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <MandalaPattern />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>Verify OTP</Text>
          <Text style={styles.subtitle}>Enter the code sent to {phone}</Text>

          {/* OTP Inputs */}
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => inputRefs.current[index] = ref!}
                style={[styles.otpInput, digit && styles.otpInputFilled]}
                value={digit}
                onChangeText={(value) => handleOtpChange(value.replace(/[^0-9]/g, ''), index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
              />
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          
          {loading && (
            <ActivityIndicator color="#FFFFFF" style={{ marginTop: SPACING.md }} />
          )}

          {/* Resend */}
          <TouchableOpacity 
            style={styles.resendButton} 
            onPress={handleResend}
            disabled={resendTimer > 0}
          >
            <Text style={[styles.resendText, resendTimer > 0 && styles.resendTextDisabled]}>
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
  },
  keyboardView: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
    padding: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: SPACING.xl,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  otpInput: {
    width: 50,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  otpInputFilled: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  error: {
    color: '#FFCCCC',
    fontSize: 14,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  resendButton: {
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  resendText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  resendTextDisabled: {
    color: 'rgba(255,255,255,0.5)',
  },
});
